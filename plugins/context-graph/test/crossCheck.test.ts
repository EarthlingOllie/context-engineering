// crossCheck: intended vs actual (v3 design.md 4.4, features v3-10, v3-11).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crossCheck, parseCodeRef } from '../src/core/crossCheck.ts'
import { assemble, scanFile } from '../src/core/codeScan.ts'
import { applyUmlOps, emptyUml } from '../src/core/uml.ts'
import type { UmlSnapshot } from '../src/core/timeline.ts'
import type { UmlOp } from '../src/core/types.ts'

/** A small source tree, scanned and assembled through the public scanner. */
const SRC: Record<string, string> = {
  'core/svg.ts': [
    "import type { Scene } from './scene.ts'",
    "export interface SvgOptions { width: number; theme: 'dark' | 'light' }",
    'export function renderSvg(scene: Scene, o: SvgOptions): string { return "" }',
    'export const SVG_NS = "x"',
  ].join('\n'),
  'core/scene.ts': [
    "import * as M from '../../vendor/three-math/index.js'",
    "export type { Graph } from './types.ts'",
    "import { Graph } from './types.ts'",
    'export interface Scene { nodes: SceneNode[] }',
    'export interface SceneNode { id: string }',
    'export function buildScene(g: Graph): Scene { return { nodes: [] } }',
  ].join('\n'),
  'core/types.ts': "export * from './graph-types.ts'\n",
  'core/graph-types.ts': 'export interface Graph { nodes: string[]; seq: number }\nexport abstract class Base { run(): void {} }\nexport class Impl extends Base implements Graph { nodes: string[] = []; seq = 0 }',
  'core/prng.ts': 'export function mulberry(seed: number) { return () => seed }',
  'core/user.ts': "import { buildScene } from './scene.ts'\nimport { renderSvg } from './svg.ts'\nimport * as THREE from 'three'\nexport function show() {}",
  'lib/a.ts': 'export function helper() {}',
  'lib/helper.ts': 'export const helperValue = 1',
  'other/helper.ts': 'export const other = 1',
}
const actualOf = (src: Record<string, string>, order?: string[]) =>
  assemble((order ?? Object.keys(src)).map((p) => scanFile(p, src[p]!)), '/repo/src')

const isDec = () => ({ status: 'active' as const, label: 'd' })
/** Applies UML ops (all under decision:d) and returns the snapshot. */
const snap = (ops: Record<string, unknown>[]): UmlSnapshot => {
  const full = ops.map((o) => ({ decision: 'decision:d', ...o }) as UmlOp)
  const { model, results } = applyUmlOps(emptyUml(), full, { decision: isDec, solSeq: 1 })
  assert.deepEqual(results.filter((r) => !r.ok), [])
  return { elements: model.elements, relations: model.relations }
}
const add = (kind: string, name: string, code?: string, extra: Record<string, unknown> = {}) =>
  ({ op: 'uml.add', kind, name, ...(code === undefined ? {} : { code }), ...extra })
const rm = (id: string) => ({ op: 'uml.remove', id, reason: 'dropped' })

test('v3-10: parseCodeRef reads every code-ref form', () => {
  assert.deepEqual(parseCodeRef(undefined), { kind: 'absent' })
  assert.deepEqual(parseCodeRef('  '), { kind: 'absent' })
  assert.deepEqual(parseCodeRef('none'), { kind: 'none' })
  assert.deepEqual(parseCodeRef('npm:three'), { kind: 'npm', pkg: 'three' })
  assert.deepEqual(parseCodeRef('npm:@scope/pkg/sub'), { kind: 'npm', pkg: '@scope/pkg' })
  assert.deepEqual(parseCodeRef('core/svg.ts'), { kind: 'path', path: 'core/svg', outside: false, folder: false })
  assert.deepEqual(parseCodeRef('./core/svg'), { kind: 'path', path: 'core/svg', outside: false, folder: false })
  assert.deepEqual(parseCodeRef('core/svg.ts#SvgOptions'), { kind: 'path', path: 'core/svg', name: 'SvgOptions', outside: false, folder: false })
  assert.deepEqual(parseCodeRef('core/svg.ts#SvgOptions.theme'), { kind: 'path', path: 'core/svg', name: 'SvgOptions', member: 'theme', outside: false, folder: false })
  assert.deepEqual(parseCodeRef('core/'), { kind: 'path', path: 'core/', outside: false, folder: true })
  assert.deepEqual(parseCodeRef('../vendor/three-math'), { kind: 'path', path: '../vendor/three-math', outside: true, folder: false })
  assert.deepEqual(parseCodeRef('../hooks/register.tsx'), { kind: 'path', path: '../hooks/register', outside: true, folder: false })
  assert.deepEqual(parseCodeRef('/abs/x'), { kind: 'path', path: '/abs/x', outside: true, folder: false })
})

test('v3-10: element rules apply in order and give the flag for active and removed elements', () => {
  const a = actualOf(SRC)
  const cc = crossCheck(snap([
    add('component', 'CDN', 'none'),
    add('component', 'three', 'npm:three'),
    add('component', 'react', 'npm:react'),
    add('component', 'ThreeMath', '../vendor/three-math'),
    add('component', 'Hooks', '../hooks/register.tsx'),
    add('component', 'Abs', '/abs/x'),
    add('component', 'Svg', 'core/svg.ts'),
    add('component', 'SvgNoExt', './core/svg'),
    add('component', 'Core', 'core/'),
    add('component', 'Missing', 'core/missing.ts'),
    add('component', 'EmptyFolder', 'nowhere/'),
    add('interface', 'Opts', 'core/svg.ts#SvgOptions'),
    add('interface', 'Ghost', 'core/svg.ts#Ghost'),
    add('component', 'RenderFn', 'core/svg.ts#renderSvg'),
    add('component', 'Scene'),
    add('interface', 'scene node'),
    add('class', 'SceneNode', undefined, { id: 'uml:scene-node-class' }),
    add('component', 'helper'),
    add('component', 'Nope'),
    add('component', 'Gone', 'core/gone.ts'),
    add('component', 'Kept', 'core/prng.ts'),
    add('component', 'OldCdn', 'none'),
    rm('uml:gone'), rm('uml:kept'), rm('uml:old-cdn'),
  ]), a)
  const flags = Object.fromEntries(Object.entries(cc.elements).map(([id, e]) => [id, e.flag]))
  assert.deepEqual(flags, {
    'uml:cdn': 'unchecked',
    'uml:three': 'matching',
    'uml:react': 'planned-not-built',
    'uml:three-math': 'matching',
    'uml:hooks': 'unchecked',
    'uml:abs': 'unchecked',
    'uml:svg': 'matching',
    'uml:svg-no-ext': 'matching',
    'uml:core': 'matching',
    'uml:missing': 'planned-not-built',
    'uml:empty-folder': 'planned-not-built',
    'uml:opts': 'matching',
    'uml:ghost': 'planned-not-built',
    'uml:render-fn': 'matching',
    'uml:scene': 'matching',
    'uml:scene-node': 'matching',
    'uml:scene-node-class': 'planned-not-built',
    'uml:helper': 'matching',
    'uml:nope': 'planned-not-built',
    'uml:gone': null,
    'uml:kept': 'removed-but-built',
    'uml:old-cdn': 'unchecked',
  })
  assert.equal(cc.elements['uml:svg']!.actual, 'core/svg.ts')
  assert.equal(cc.elements['uml:opts']!.actual, 'core/svg.ts#SvgOptions')
  assert.equal(cc.elements['uml:scene-node']!.actual, 'core/scene.ts#SceneNode')
  assert.equal(cc.elements['uml:three']!.actual, 'core/user.ts')
  assert.equal(cc.elements['uml:three-math']!.actual, 'core/scene.ts')
  // two modules are named helper: the first path in sort order wins and the match is marked ambiguous
  assert.equal(cc.elements['uml:helper']!.actual, 'lib/helper.ts')
  assert.equal(cc.elements['uml:helper']!.ambiguous, true)
  assert.equal(cc.elements['uml:svg']!.ambiguous, undefined)
  assert.equal(cc.elements['uml:missing']!.actual, undefined)
})

test('v3-10: unplanned modules and types, counts, and independence from record order', () => {
  const a = actualOf(SRC)
  const s = snap([
    add('component', 'Svg', 'core/svg.ts'),
    add('interface', 'Graph', 'core/graph-types.ts#Graph'),
    add('component', 'Old', 'core/prng.ts'),
    add('component', 'Ghost', 'core/ghost.ts'),
    add('component', 'Cdn', 'none'),
    rm('uml:old'),
  ])
  const cc = crossCheck(s, a)
  // svg.ts directly, graph-types.ts through a type inside, prng.ts through a removed element
  assert.deepEqual(cc.unplanned.modules, ['core/scene.ts', 'core/types.ts', 'core/user.ts', 'lib/a.ts', 'lib/helper.ts', 'other/helper.ts'])
  // SvgOptions is inside a planned module but no class/interface matched it
  assert.deepEqual(cc.unplanned.types, ['core/graph-types.ts#Base', 'core/graph-types.ts#Impl', 'core/scene.ts#Scene', 'core/scene.ts#SceneNode', 'core/svg.ts#SvgOptions'])
  assert.deepEqual(cc.counts, { matching: 2, 'planned-not-built': 1, 'built-not-planned': 6, 'removed-but-built': 1, unchecked: 1 })
  const flagged = Object.values(cc.elements).filter((e) => e.flag !== null).length
  assert.equal(Object.values(cc.counts).reduce((x, y) => x + y, 0), flagged + cc.unplanned.modules.length)

  const reversed = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).reverse())
  const s2 = { elements: reversed(s.elements), relations: reversed(s.relations) } as UmlSnapshot
  const a2 = actualOf(SRC, Object.keys(SRC).reverse())
  assert.deepEqual(crossCheck(s2, a2), cc)
  assert.equal(JSON.stringify(crossCheck(s2, a2)), JSON.stringify(cc))
})

test('v3-11: members check against module functions/consts or the type members; removed members are not checked', () => {
  const a = actualOf(SRC)
  const cc = crossCheck(snap([
    add('component', 'Svg', 'core/svg.ts', { operations: ['+renderSvg(scene, o) string', '+renderPng() Buffer'], attributes: ['SVG_NS', 'buildScene', 'gone'] }),
    { op: 'uml.remove', id: 'uml:svg', member: 'gone', reason: 'x' },
    add('interface', 'SvgOptions', 'core/svg.ts#SvgOptions', { attributes: ['width: number', 'theme', 'height: number'] }),
    add('class', 'Impl', undefined, { attributes: ['nodes'], operations: ['run()'] }),
    add('component', 'Cdn', 'none', { operations: ['load()'] }),
    add('component', 'Missing', 'core/missing.ts', { operations: ['x()'] }),
  ]), a)
  assert.equal(cc.elements['uml:svg']!.flag, 'matching')
  // operations against functions, attributes against consts (buildScene is a function of another module)
  assert.deepEqual(cc.elements['uml:svg']!.members, { renderSvg: 'matching', renderPng: 'planned-not-built', SVG_NS: 'matching', buildScene: 'planned-not-built' })
  assert.deepEqual(cc.elements['uml:svg-options']!.members, { width: 'matching', theme: 'matching', height: 'planned-not-built' })
  // a class's own members only (run is inherited from Base, not declared on Impl)
  assert.deepEqual(cc.elements['uml:impl']!.members, { nodes: 'matching', run: 'planned-not-built' })
  assert.deepEqual(cc.elements['uml:cdn']!.members, {})
  assert.deepEqual(cc.elements['uml:missing']!.members, {})
})

const rel = (kind: string, from: string, to: string) => ({ op: 'uml.relate', kind, from, to })

test('v3-11: relations lift to modules, follow re-exports, and flag unchecked, removed and unplanned', () => {
  const a = actualOf(SRC)
  const cc = crossCheck(snap([
    add('component', 'User', 'core/user.ts'), add('component', 'Scene', 'core/scene.ts'),
    add('component', 'Svg', 'core/svg.ts'), add('component', 'Prng', 'core/prng.ts'),
    add('interface', 'SvgOptions', 'core/svg.ts#SvgOptions', { in: 'uml:svg' }),
    add('interface', 'Graph', 'core/graph-types.ts#Graph'), add('class', 'Impl'), add('class', 'Base'), add('class', 'Other'),
    add('component', 'ThreeMath', '../vendor/three-math'), add('component', 'three', 'npm:three'),
    add('component', 'Cdn', 'none'), add('component', 'Ghost', 'core/ghost.ts'),
    rel('dependency', 'uml:user', 'uml:graph'), // user -> scene -> (re-export) types -> (re-export) graph-types
    rel('dependency', 'uml:scene', 'uml:graph'), // scene -> types -> (re-export) graph-types
    rel('dependency', 'uml:user', 'uml:three'), rel('dependency', 'uml:scene', 'uml:three-math'),
    rel('dependency', 'uml:user', 'uml:three-math'), rel('dependency', 'uml:graph', 'uml:user'),
    rel('realization', 'uml:impl', 'uml:graph'), rel('generalization', 'uml:impl', 'uml:base'),
    rel('generalization', 'uml:other', 'uml:base'), rel('realization', 'uml:svg', 'uml:svg-options'),
    rel('association', 'uml:svg', 'uml:prng'), rel('dependency', 'uml:cdn', 'uml:svg'),
    rel('dependency', 'uml:svg', 'uml:ghost'),
    rel('dependency', 'uml:user', 'uml:svg'), rel('dependency', 'uml:svg', 'uml:prng'),
    { op: 'uml.remove', from: 'uml:user', kind: 'dependency', to: 'uml:svg', reason: 'x' },
    { op: 'uml.remove', from: 'uml:svg', kind: 'dependency', to: 'uml:prng', reason: 'x' },
  ]), a)
  assert.deepEqual(cc.relations, {
    'uml:svg|composition|uml:svg-options': 'matching', // both ends in the same module
    'uml:user|dependency|uml:graph': 'matching',
    'uml:scene|dependency|uml:graph': 'matching',
    'uml:user|dependency|uml:three': 'matching',
    'uml:scene|dependency|uml:three-math': 'matching',
    'uml:user|dependency|uml:three-math': 'planned-not-built',
    'uml:graph|dependency|uml:user': 'planned-not-built', // direction matters
    'uml:impl|realization|uml:graph': 'matching',
    'uml:impl|generalization|uml:base': 'matching',
    'uml:other|generalization|uml:base': 'planned-not-built', // Other is not built
    'uml:svg|realization|uml:svg-options': 'planned-not-built', // a component has no implements
    'uml:svg|association|uml:prng': 'planned-not-built',
    'uml:cdn|dependency|uml:svg': 'unchecked',
    'uml:svg|dependency|uml:ghost': 'planned-not-built',
    'uml:user|dependency|uml:svg': 'removed-but-built',
    'uml:svg|dependency|uml:prng': null,
  })
  // user -> scene and svg -> scene are built between planned modules with no intended relation either way
  assert.deepEqual(cc.unplanned.relations, [
    { from: 'core/svg.ts', to: 'core/scene.ts', kind: 'dependency', typeOnly: true },
    { from: 'core/user.ts', to: 'core/scene.ts', kind: 'dependency' },
  ])
})

test('v3-11: dependency matching follows at most 3 re-export hops', () => {
  const src: Record<string, string> = {
    'c0.ts': "import { x } from './c1.ts'",
    'c1.ts': "export * from './c2.ts'",
    'c2.ts': "export * from './c3.ts'",
    'c3.ts': "export * from './c4.ts'",
    'c4.ts': "export * from './c5.ts'",
    'c5.ts': 'export const x = 1',
  }
  const cc = crossCheck(snap([
    ...['c0', 'c1', 'c2', 'c3', 'c4', 'c5'].map((c) => add('component', c.toUpperCase(), `${c}.ts`)),
    rel('dependency', 'uml:c0', 'uml:c1'), rel('dependency', 'uml:c0', 'uml:c4'), rel('dependency', 'uml:c0', 'uml:c5'),
    rel('composition', 'uml:c1', 'uml:c4'),
  ]), actualOf(src))
  assert.deepEqual(cc.relations, {
    'uml:c0|dependency|uml:c1': 'matching',
    'uml:c0|dependency|uml:c4': 'matching',
    'uml:c0|dependency|uml:c5': 'planned-not-built',
    'uml:c1|composition|uml:c4': 'matching',
  })
})
