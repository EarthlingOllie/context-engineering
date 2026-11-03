// codeScan: the actual design from source (v3 design.md 4.3, features v3-07..v3-09).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { assemble, collectSources, scanFile, SCAN_LIMITS } from '../src/core/codeScan.ts'
import type { FileScan, SourceFs } from '../src/core/codeScan.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/scan/${name}`, import.meta.url), 'utf8')

test('v3-07: only real depth-0 imports are reported, never ones in comments, strings, templates or String.raw', () => {
  const scan = scanFile('lexer.ts', fixture('lexer.ts.txt'))
  assert.deepEqual(scan.imports.map((i) => [i.spec, i.line, i.typeOnly, i.reexport]), [
    ['./real1.ts', 4, false, false],
    ['./type-only.ts', 16, true, false],
    ['./default-ns.ts', 17, false, false],
    ['./side-effect.ts', 18, false, false],
    ['./star.ts', 19, false, true],
    ['./named.ts', 20, false, true],
    ['./type-reexport.ts', 21, true, true],
    ['./after-big.ts', 127, false, false],
  ])
  assert.deepEqual(scan.errors, [])
})

test('v3-07: declarations: classes, interfaces, object types, enums, functions and consts', () => {
  const scan = scanFile('decls.ts', fixture('decls.ts.txt'))
  assert.deepEqual(scan.errors, [])
  assert.deepEqual(scan.imports.map((i) => i.spec), ['./base.ts'])
  const byName = Object.fromEntries(scan.types.map((t) => [t.name, t]))
  assert.deepEqual(scan.types.map((t) => [t.name, t.kind, t.exported, t.stereotype ?? '', t.line]), [
    ['Shape', 'class', true, '', 3],
    ['Animal', 'class', true, 'abstract', 12],
    ['Hidden', 'class', false, '', 16],
    ['Drawable', 'interface', true, '', 17],
    ['Options', 'interface', true, 'type', 23],
    ['Color', 'interface', true, 'enum', 28],
  ])
  const shape = byName.Shape!
  assert.deepEqual([shape.extends, shape.implements], [['Base'], ['Drawable', 'Sized']])
  assert.deepEqual(shape.attributes.map((m) => [m.name, m.visibility, m.text]), [
    ['secret', '-', '-secret: string'],
    ['hidden', '-', '-hidden'],
    ['name', '+', '+name: string'],
  ])
  assert.deepEqual(shape.operations.map((m) => [m.name, m.visibility, m.text]), [
    ['guard', '#', '#guard(x: number) boolean'],
    ['create', '+', '+create(a: number, b: { c: string }) Shape'],
    ['area', '+', '+area(scale: number) number'],
  ])
  assert.deepEqual(byName.Animal!.operations.map((m) => m.text), ['+speak() void'])
  assert.deepEqual(byName.Animal!.attributes.map((m) => m.text), ['+legs?: number'])
  const drawable = byName.Drawable!
  assert.deepEqual(drawable.extends, ['Base', 'Other'])
  assert.deepEqual(drawable.operations.map((m) => m.text), ['+draw(ctx: Ctx) void'])
  assert.deepEqual(drawable.attributes.map((m) => m.text), ['+label?: string', '+onClick: (e: Event) => void'])
  assert.deepEqual(byName.Options!.attributes.map((m) => m.text), ['+width: number'])
  assert.deepEqual(byName.Options!.operations.map((m) => m.text), ['+cb(x: number) string'])
  assert.deepEqual(byName.Color!.attributes.map((m) => m.text), ['+Red', '+Green', '+Blue'])
  assert.deepEqual(scan.functions.map((m) => [m.name, m.kind, m.text]), [
    ['plain', 'operation', '+plain(a: string) number'],
    ['later', 'operation', '+later() Promise<void>'],
    ['arrow', 'operation', '+arrow(x: number, y: number)'],
    ['veryLongName', 'operation', '+veryLongName(alpha: string, beta: number, gamma: Record<string, Array<number>>…'],
  ])
  assert.equal(scan.functions[3]!.text.length, 80)
  assert.deepEqual(scan.consts.map((m) => [m.name, m.kind, m.text]), [['N', 'attribute', '+N']])
})

test('v3-07: on a verbatim copy of v2 exportHtml.ts the imports are exactly the five local modules, never three', () => {
  const scan = scanFile('core/exportHtml.ts', fixture('exportHtml-v2.ts.txt'))
  assert.deepEqual(scan.errors, [])
  assert.deepEqual(scan.imports.map((i) => [i.spec, i.line, i.typeOnly]), [
    ['./scene.ts', 3, false], ['./svg.ts', 4, false], ['./types.ts', 5, true],
    ['./scene.ts', 190, false], ['./svg.ts', 191, false], ['./health.ts', 192, true], ['./relevance.ts', 193, true], ['./types.ts', 194, true],
  ])
  assert.ok(scan.imports.every((i) => !i.spec.startsWith('three')))
  assert.ok(scan.functions.some((f) => f.name === 'exportSolutionHtml'))
})

test('v3-07: unbalanced input records errors, keeps what it found and never throws', () => {
  const text = [
    "import { a } from './a.ts'",
    'export class Broken {',
    '  open(x: number) {',
    '    if (x) {',
    "export function after(): void {}",
    "import './late.ts'",
    '}}}}',
    "const s = 'unterminated",
    'const t = `never closed ${ {',
  ].join('\n')
  let scan: ReturnType<typeof scanFile> | undefined
  assert.doesNotThrow(() => { scan = scanFile('broken.ts', text) })
  assert.ok(scan!.errors.length > 0)
  assert.deepEqual(scan!.imports.map((i) => i.spec), ['./a.ts', './late.ts'])
  assert.ok(scan!.functions.some((f) => f.name === 'after'))
  assert.ok(scan!.types.some((t) => t.name === 'Broken'))
  for (const junk of ['', '}', '{', '`', '/*', "'", 'export', 'export class', 'import {', 'export const x = (', '/[/', 'a / b / c / d']) {
    assert.doesNotThrow(() => scanFile('junk.ts', junk), junk)
  }
})

test('v3-07: a 4000-line file scans in under 40 ms', () => {
  const block = fixture('decls.ts.txt').split('\n').slice(1, 30).join('\n')
  const lines: string[] = []
  let n = 0
  while (lines.length < 4000) lines.push(...block.replace(/\b(Shape|Animal|Hidden|Drawable|Options|Color|plain|later|arrow|N|veryLongName)\b/g, `$1${n++}`).split('\n'))
  const text = lines.slice(0, 4000).join('\n')
  for (let r = 0; r < 3; r++) scanFile('warm.ts', text)
  let ms = Infinity
  let scan = scanFile('warm.ts', '')
  for (let r = 0; r < 5; r++) { // best of 5 after a warm-up: the bound is on the scanner, not on a busy test machine
    const t0 = performance.now()
    scan = scanFile('big.ts', text)
    ms = Math.min(ms, performance.now() - t0)
  }
  assert.ok(scan.types.length > 100)
  assert.ok(ms < 40, `${ms.toFixed(1)} ms`)
})

const scans = (files: Record<string, string>): FileScan[] => Object.entries(files).map(([p, t]) => scanFile(p, t))

test('v3-08: import resolution: .js to .ts, extensionless, index, outside the root and package names', () => {
  const d = assemble(scans({
    'core/camera.ts': [
      "import { Matrix4 } from '../../vendor/three-math/index.js'",
      "import { x } from './x.js'",
      "import { y } from './y'",
      "import { w } from './w'",
      "import { z } from './z'",
      "import type { Pkg } from './pkg'",
      "import { OrbitControls } from 'three/addons/x.js'",
      "import * as THREE from 'three'",
      "import { s } from '@scope/pkg/sub'",
      "import { m } from './m.mjs'",
      "import { gone } from './missing.js'",
    ].join('\n'),
    'core/x.ts': '', 'core/y.tsx': '', 'core/w.mjs': '', 'core/z/index.ts': '', 'core/pkg/index.js': '', 'core/m.mts': '',
  }), '/repo/src')
  const cam = d.modules['core/camera.ts']!
  assert.equal(cam.name, 'camera')
  assert.deepEqual(cam.deps, ['core/x.ts', 'core/y.tsx', 'core/w.mjs', 'core/z/index.ts', 'core/pkg/index.js', 'core/m.mts'])
  assert.deepEqual(cam.outside, ['../vendor/three-math/index.js'])
  assert.deepEqual(cam.externals, ['three', '@scope/pkg'])
  assert.equal(d.modules['core/z/index.ts']!.name, 'index')
  assert.deepEqual(d.relations.filter((r) => r.from === 'core/camera.ts').map((r) => [r.to, r.kind, r.typeOnly ?? false]), [
    ['core/x.ts', 'dependency', false], ['core/y.tsx', 'dependency', false], ['core/w.mjs', 'dependency', false],
    ['core/z/index.ts', 'dependency', false], ['core/pkg/index.js', 'dependency', true], ['core/m.mts', 'dependency', false],
  ])
})

test('v3-08: a dependency is typeOnly only when every import of the pair is; re-exports are recorded', () => {
  const d = assemble(scans({
    'a.ts': "import type { T } from './b.ts'\nimport { v } from './b.ts'\nimport type { U } from './c.ts'\nexport * from './d.ts'\nexport { e } from './e.ts'",
    'b.ts': '', 'c.ts': '', 'd.ts': '', 'e.ts': '',
  }), '/r')
  assert.deepEqual(d.relations.map((r) => [r.from, r.to, r.kind, r.typeOnly ?? false]), [
    ['a.ts', 'b.ts', 'dependency', false], ['a.ts', 'c.ts', 'dependency', true],
    ['a.ts', 'd.ts', 'dependency', false], ['a.ts', 'e.ts', 'dependency', false],
  ])
  assert.deepEqual(d.modules['a.ts']!.reexports, ['d.ts', 'e.ts'])
  assert.equal(d.root, '/r')
})

test('v3-08: extends/implements resolve same module first, then a unique name, else dropped; attribute types give associations', () => {
  const d = assemble(scans({
    'a.ts': [
      'export interface Shape { area(): number }',
      'export class Base {}',
      'export class Circle extends Base implements Shape, Unknown, Dup {',
      '  parts: Part[]',
      '  index: Record<string, Shape>',
      '  label: string',
      '  self: Circle',
      '}',
    ].join('\n'),
    'b.ts': 'export class Base {}\nexport class Part {}\nexport interface Dup {}',
    'c.ts': 'export interface Dup {}\nexport interface Wide extends Shape {}\nclass Local {}',
  }), '/r')
  assert.deepEqual(Object.keys(d.types).sort(), ['a.ts#Base', 'a.ts#Circle', 'a.ts#Shape', 'b.ts#Base', 'b.ts#Dup', 'b.ts#Part', 'c.ts#Dup', 'c.ts#Local', 'c.ts#Wide'])
  const circle = d.types['a.ts#Circle']!
  assert.deepEqual([circle.module, circle.name, circle.kind, circle.exported], ['a.ts', 'Circle', 'class', true])
  assert.equal(d.types['c.ts#Local']!.exported, false)
  const typeRels = d.relations.filter((r) => r.kind !== 'dependency').map((r) => [r.from, r.kind, r.to])
  assert.deepEqual(typeRels, [
    ['a.ts#Circle', 'generalization', 'a.ts#Base'],
    ['a.ts#Circle', 'realization', 'a.ts#Shape'],
    ['a.ts#Circle', 'association', 'b.ts#Part'],
    ['a.ts#Circle', 'association', 'a.ts#Shape'],
    ['c.ts#Wide', 'generalization', 'a.ts#Shape'],
  ])
})

const ROOT = new URL('../src/', import.meta.url).pathname.replace(/\/$/, '')
const scanTree = (root: string): FileScan[] => {
  const out: FileScan[] = []
  const walk = (rel: string): void => {
    for (const name of readdirSync(rel ? `${root}/${rel}` : root).sort()) {
      const p = rel ? `${rel}/${name}` : name
      if (statSync(`${root}/${p}`).isDirectory()) walk(p)
      else if (name.endsWith('.ts')) out.push(scanFile(p, readFileSync(`${root}/${p}`, 'utf8')))
    }
  }
  walk('')
  return out
}

test('v3-08: on plugins/context-graph/src: types.ts re-exports solution-types.ts, exportHtml.ts depends on scene and svg, no externals', () => {
  const d = assemble(scanTree(ROOT), ROOT)
  assert.ok(d.modules['core/types.ts']!.reexports.includes('core/solution-types.ts'))
  const ex = d.modules['core/exportHtml.ts']!
  assert.ok(ex.deps.includes('core/scene.ts') && ex.deps.includes('core/svg.ts'))
  assert.deepEqual(ex.externals, [])
  assert.deepEqual(d.modules['core/camera.ts']!.outside, ['../vendor/three-math/index.js'])
})

/** In-memory SourceFs: path -> text (file) | { size, mtimeMs, text?, fail? }; directories are implied by paths. */
type FakeFile = string | { text?: string; size?: number; mtimeMs?: number; fail?: string }
const fakeFs = (root: string, files: Record<string, FakeFile>) => {
  const reads: string[] = []
  const lists: string[] = []
  const norm = (f: FakeFile) => (typeof f === 'string' ? { text: f, size: f.length, mtimeMs: 1 } : { text: f.text ?? '', size: f.size ?? (f.text ?? '').length, mtimeMs: f.mtimeMs ?? 1, fail: f.fail })
  const fs: SourceFs = {
    async list(path) {
      lists.push(path)
      const prefix = path === root ? '' : path.slice(root.length + 1) + '/'
      const entries = new Map<string, { name: string; kind: 'file' | 'directory'; size: number; mtimeMs: number }>()
      for (const [p, f] of Object.entries(files)) {
        if (!p.startsWith(prefix)) continue
        const rest = p.slice(prefix.length)
        const slash = rest.indexOf('/')
        if (slash === -1) { const n = norm(f); entries.set(rest, { name: rest, kind: 'file', size: n.size, mtimeMs: n.mtimeMs }) }
        else entries.set(rest.slice(0, slash), { name: rest.slice(0, slash), kind: 'directory', size: 0, mtimeMs: 0 })
      }
      return [...entries.values()].reverse()
    },
    async read(path) {
      reads.push(path)
      const f = files[path.slice(root.length + 1)]
      if (f === undefined) throw new Error('ENOENT')
      const n = norm(f)
      if (n.fail) throw new Error(n.fail)
      return n.text
    },
  }
  return { fs, reads, lists }
}

test('v3-09: reads only source files, skips excluded entries with a reason, sorted and deterministic', async () => {
  const { fs, reads } = fakeFs('/r', {
    'b.ts': 'export const b = 1', 'a.tsx': '', 'c.mts': '', 'd.cts': '', 'e.js': '', 'f.jsx': '', 'g.mjs': '', 'h.cjs': '',
    'README.md': '', 'data.json': '', 'x.d.ts': '', 'x.test.ts': '', 'x.spec.js': '', '.hidden.ts': '',
    'node_modules/p/i.js': '', 'dist/i.js': '', 'build/i.js': '', 'coverage/i.js': '', 'vendor/i.js': '',
    'test/i.ts': '', 'tests/i.ts': '', '__tests__/i.ts': '', '.git/i.ts': '', 'sub/z.ts': "import './y.ts'",
  })
  const res = await collectSources('/r', fs)
  assert.deepEqual(Object.keys(res.files), ['.hidden.ts', 'a.tsx', 'b.ts', 'c.mts', 'd.cts', 'e.js', 'f.jsx', 'g.mjs', 'h.cjs', 'sub/z.ts'].filter((p) => p !== '.hidden.ts'))
  assert.deepEqual(reads, ['/r/a.tsx', '/r/b.ts', '/r/c.mts', '/r/d.cts', '/r/e.js', '/r/f.jsx', '/r/g.mjs', '/r/h.cjs', '/r/sub/z.ts'])
  assert.equal(res.read, 9)
  assert.deepEqual(res.skipped, [
    { path: '.git', reason: 'excluded' }, { path: '.hidden.ts', reason: 'excluded' }, { path: '__tests__', reason: 'excluded' },
    { path: 'build', reason: 'excluded' }, { path: 'coverage', reason: 'excluded' }, { path: 'dist', reason: 'excluded' },
    { path: 'node_modules', reason: 'excluded' }, { path: 'test', reason: 'excluded' }, { path: 'tests', reason: 'excluded' },
    { path: 'vendor', reason: 'excluded' }, { path: 'x.d.ts', reason: 'excluded' }, { path: 'x.spec.js', reason: 'excluded' },
    { path: 'x.test.ts', reason: 'excluded' },
  ])
  assert.equal(res.truncated, false)
  assert.deepEqual(res.files['b.ts']!.scan.consts.map((c) => c.name), ['b'])
  assert.equal(res.files['sub/z.ts']!.scan.path, 'sub/z.ts')
  assert.deepEqual(await collectSources('/r', fakeFs('/r', { 'b.ts': 'export const b = 1', 'a.tsx': '' }).fs).then((r) => Object.keys(r.files)), ['a.tsx', 'b.ts'])
})

test('v3-09: limits: too-large files, the 401st file, depth over 8 and the total bytes cap', async () => {
  const big = await collectSources('/r', fakeFs('/r', { 'a.ts': { size: 262145 }, 'b.ts': { size: 262144 } }).fs)
  assert.deepEqual(big.skipped, [{ path: 'a.ts', reason: 'too-large' }])
  assert.deepEqual(Object.keys(big.files), ['b.ts'])
  assert.equal(big.truncated, false)

  const many: Record<string, FakeFile> = {}
  for (let i = 0; i < 405; i++) many[`f${String(i).padStart(3, '0')}.ts`] = ''
  const capped = await collectSources('/r', fakeFs('/r', many).fs)
  assert.equal(Object.keys(capped.files).length, SCAN_LIMITS.files)
  assert.deepEqual(capped.skipped, [{ path: 'f400.ts', reason: 'limit' }])
  assert.equal(capped.truncated, true)

  const deep = await collectSources('/r', fakeFs('/r', { '1/2/3/4/5/6/7/8/ok.ts': '', '1/2/3/4/5/6/7/8/9/no.ts': '' }).fs)
  assert.deepEqual(Object.keys(deep.files), ['1/2/3/4/5/6/7/8/ok.ts'])
  assert.deepEqual(deep.skipped, [{ path: '1/2/3/4/5/6/7/8/9', reason: 'limit' }])
  assert.equal(deep.truncated, true)

  const heavy: Record<string, FakeFile> = {}
  for (let i = 0; i < 20; i++) heavy[`h${String(i).padStart(2, '0')}.ts`] = { size: 250000 }
  const bytes = await collectSources('/r', fakeFs('/r', heavy).fs)
  const total = Object.values(bytes.files).reduce((n, f) => n + f.size, 0)
  assert.equal(Object.keys(bytes.files).length, 16)
  assert.ok(total <= SCAN_LIMITS.totalBytes)
  assert.deepEqual(bytes.skipped, [{ path: 'h16.ts', reason: 'limit' }])
  assert.equal(bytes.truncated, true)
})

test('v3-09: with prev only changed or new files are read, deleted files disappear, failed reads are skipped', async () => {
  const files: Record<string, FakeFile> = { 'a.ts': { text: 'export const a = 1', mtimeMs: 1 }, 'b.ts': { text: 'export const b = 1', mtimeMs: 1 }, 'c.ts': { text: '', mtimeMs: 1 } }
  const first = await collectSources('/r', fakeFs('/r', files).fs)
  assert.equal(first.read, 3)
  delete files['c.ts']
  files['b.ts'] = { text: 'export const b2 = 2', mtimeMs: 2 }
  files['d.ts'] = { text: 'export const d = 1', mtimeMs: 1 }
  files['e.ts'] = { fail: 'EACCES: permission denied' }
  const second = fakeFs('/r', files)
  const res = await collectSources('/r', second.fs, { prev: first.files })
  assert.deepEqual(second.reads, ['/r/b.ts', '/r/d.ts', '/r/e.ts'])
  assert.equal(res.read, 3)
  assert.deepEqual(Object.keys(res.files), ['a.ts', 'b.ts', 'd.ts'])
  assert.equal(res.files['a.ts']!.scan, first.files['a.ts']!.scan)
  assert.deepEqual(res.files['b.ts']!.scan.consts.map((c) => c.name), ['b2'])
  assert.deepEqual(res.skipped, [{ path: 'e.ts', reason: 'read: EACCES: permission denied' }])
})

test('v3-09: a failing list never rejects', async () => {
  const fs: SourceFs = { list: async () => { throw new Error('ENOTDIR') }, read: async () => '' }
  const res = await collectSources('/nowhere', fs)
  assert.deepEqual(res, { files: {}, skipped: [{ path: '', reason: 'list: ENOTDIR' }], truncated: false, read: 0 })
})
