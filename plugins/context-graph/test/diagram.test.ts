// diagram: one diagram for both renderers (v3 design.md 4.5, feature v3-12).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyDesignOps, emptyUml, parseDesignSeed } from '../src/core/uml.ts'
import { emptyModel } from '../src/core/solution.ts'
import { assemble, scanFile } from '../src/core/codeScan.ts'
import { buildDiagram, umlPageData } from '../src/core/diagram.ts'
import type { Diagram } from '../src/core/diagram.ts'
import type { DesignOp } from '../src/core/types.ts'

const design = (ops: DesignOp[]) => applyDesignOps({ sol: emptyModel(), uml: emptyUml() }, ops).state
const fixture = () => {
  const seed = parseDesignSeed(readFileSync(new URL('./fixtures/uml-small.json', import.meta.url), 'utf8'))
  assert.deepEqual(seed.errors, [])
  return design(seed.ops)
}
/** Code for the fixture: Renderer built (render, not MAX), Options built, GlRenderer still built, plus two unplanned files. */
const SRC: Record<string, string> = {
  'core/render.ts': [
    "import { helper } from '../util/helper.ts'",
    'export interface Options { theme: string }',
    'export function render(scene: unknown): string { return "" }',
  ].join('\n'),
  'core/gl.ts': 'export class GlRenderer { frame(): void {} }',
  'util/helper.ts': 'export function helper() {}\nexport interface Extra { x: number }',
  'util/prng.ts': 'export function mulberry() {}',
}
const actual = () => assemble(Object.keys(SRC).map((p) => scanFile(p, SRC[p]!)), '/repo/src')
const el = (d: Diagram, id: string) => d.elements.find((e) => e.id === id)
const rel = (d: Diagram, id: string) => d.relations.find((r) => r.id === id)

test('v3-12: step null is the latest, steps clamp, change marks equal the step changes', () => {
  const { sol, uml } = fixture()
  const latest = buildDiagram({ uml, sol })
  assert.equal(latest.steps, 5)
  assert.equal(latest.step, 5)
  assert.equal(buildDiagram({ uml, sol, step: 99 }).step, 5)
  const zero = buildDiagram({ uml, sol, step: -3 })
  assert.equal(zero.step, 0)
  assert.equal(zero.current, null)
  assert.deepEqual(zero.elements, [])

  const s2 = buildDiagram({ uml, sol, step: 2 })
  assert.equal(s2.current?.label, 'WebGL in the pane')
  assert.equal(el(s2, 'uml:gl-renderer')?.change, 'added')
  assert.equal(el(s2, 'uml:renderer')?.change, 'changed')
  assert.equal(el(s2, 'uml:shell')?.change, null)
  assert.equal(rel(s2, 'uml:renderer|composition|uml:gl-renderer')?.change, 'added')
  // every element/relation target of the step is marked with its change, and nothing else is
  for (const k of [1, 2, 3, 4, 5]) {
    const d = buildDiagram({ uml, sol, step: k })
    const marked = [...d.elements, ...d.relations].filter((x) => x.change).map((x) => `${x.id}=${x.change}`).sort()
    const c = d.current!.changes
    const ids = new Set([...d.elements, ...d.relations].map((x) => x.id))
    const expected = new Map<string, string>()
    for (const kind of ['added', 'changed', 'removed'] as const) for (const t of c[kind]) if (ids.has(t)) expected.set(t, kind)
    // member targets mark their element 'changed' unless it has its own change
    for (const kind of ['added', 'changed', 'removed'] as const) {
      for (const t of c[kind]) if (!ids.has(t)) { const owner = t.slice(0, t.lastIndexOf('.')); if (!expected.has(owner)) expected.set(owner, 'changed') }
    }
    assert.deepEqual(marked, [...expected].map(([t, ch]) => `${t}=${ch}`).sort(), `step ${k}`)
  }
})

test('v3-12: status is abandoned after a cascade removal, removed otherwise; relations follow a removed end', () => {
  const { sol, uml } = fixture()
  const s3 = buildDiagram({ uml, sol, step: 3 })
  assert.equal(s3.current?.abandoned, true)
  assert.equal(el(s3, 'uml:gl-renderer')?.status, 'abandoned')
  assert.equal(el(s3, 'uml:gl-renderer')?.change, 'removed')
  assert.equal(rel(s3, 'uml:gl-renderer|realization|uml:drawable')?.status, 'abandoned')
  const renderer = el(s3, 'uml:renderer')! // attributes first, then operations
  assert.deepEqual(renderer.members.map((m) => [m.text, m.removed]), [['MAX: number', false], ['+render(scene) string', false], ['+renderGl(scene)', true]])
  const s4 = buildDiagram({ uml, sol, step: 4 })
  assert.equal(el(s4, 'uml:shape')?.status, 'removed')
  assert.equal(el(s4, 'uml:gl-renderer')?.status, 'abandoned')
  assert.equal(rel(s4, 'uml:renderer|association|uml:base-shape')?.status, 'removed')
  assert.equal(rel(s4, 'uml:drawable|generalization|uml:shape')?.status, 'removed', 'an end is removed')
  assert.equal(el(buildDiagram({ uml, sol }), 'uml:shape')?.status, 'active', 'revived at step 5')
})

test('v3-12: decision carries label, detail and the labels of factors that constrain it', () => {
  const { sol, uml } = fixture()
  const d = buildDiagram({ uml, sol, step: 1 })
  assert.deepEqual(d.decision, { id: 'decision:core', label: 'Pure core', drivenBy: ['Panes have no DOM'] })
  assert.deepEqual(buildDiagram({ uml, sol, step: 2 }).decision?.drivenBy, [])
  assert.equal(buildDiagram({ uml, step: 1 }).decision?.label, 'decision:core', 'without sol the id stands in')
})

test('v3-12: without actual every flag is null and counts are zero', () => {
  const { sol, uml } = fixture()
  const d = buildDiagram({ uml, sol })
  assert.ok(d.elements.every((e) => e.flag === null && e.source === 'intended' && e.members.every((m) => m.flag === undefined)))
  assert.ok(d.relations.every((r) => r.flag === null))
  assert.deepEqual(d.counts, { matching: 0, 'planned-not-built': 0, 'built-not-planned': 0, 'removed-but-built': 0, unchecked: 0, plannedMembers: 0,
    relations: { matching: 0, 'planned-not-built': 0, 'built-not-planned': 0, 'removed-but-built': 0, unchecked: 0 } })
  assert.equal(d.scan, null)
  assert.equal(d.hidden, 0)
  assert.deepEqual(d.elements.map((e) => e.id), ['uml:shell', 'uml:renderer', 'uml:options', 'uml:base-shape', 'uml:circle', 'uml:drawable', 'uml:shape', 'uml:gl-renderer'])
})

test('v3-12: cross-check flags at every step; built-not-planned only at the latest step', () => {
  const { sol, uml } = fixture()
  const a = actual()
  const s2 = buildDiagram({ uml, sol, actual: a, step: 2, scannedAt: 1000 })
  assert.equal(el(s2, 'uml:renderer')?.flag, 'matching')
  assert.equal(el(s2, 'uml:gl-renderer')?.flag, 'matching')
  assert.equal(el(s2, 'uml:shell')?.flag, 'unchecked')
  assert.equal(el(s2, 'uml:base-shape')?.flag, 'planned-not-built')
  assert.deepEqual(el(s2, 'uml:renderer')?.members.map((m) => [m.text, m.flag]),
    [['MAX: number', 'planned-not-built'], ['+render(scene) string', 'matching'], ['+renderGl(scene)', 'planned-not-built']])
  assert.ok(s2.elements.every((e) => e.source === 'intended'), 'no unplanned before the latest step')
  assert.equal(s2.counts['built-not-planned'], 0)
  assert.deepEqual(s2.scan, { root: '/repo/src', at: 1000, truncated: false })

  const s3 = buildDiagram({ uml, sol, actual: a, step: 3 })
  assert.equal(el(s3, 'uml:gl-renderer')?.flag, 'removed-but-built')
  assert.equal(rel(s3, 'uml:shell|dependency|uml:renderer')?.flag, 'unchecked')

  const latest = buildDiagram({ uml, sol, actual: a })
  const unplanned = latest.elements.filter((e) => e.source === 'actual')
  assert.deepEqual(unplanned.map((e) => [e.id, e.name, e.kind, e.code, e.flag, e.status, e.change]), [
    ['code:util/helper.ts', 'helper.ts', 'component', 'util/helper.ts', 'built-not-planned', 'active', null],
    ['code:util/prng.ts', 'prng.ts', 'component', 'util/prng.ts', 'built-not-planned', 'active', null],
  ])
  assert.deepEqual(unplanned[0]!.members.map((m) => m.text), ['+helper()'])
  assert.equal(latest.counts['built-not-planned'], 2)
  assert.deepEqual([latest.counts.matching, latest.counts['planned-not-built'], latest.counts['removed-but-built'], latest.counts.unchecked], [2, 4, 1, 1])
  assert.equal(latest.counts.plannedMembers, 1, 'Renderer.MAX (removed members are not counted)')
  assert.equal(latest.hidden, 1, 'the unplanned type Extra')
  const all = buildDiagram({ uml, sol, actual: a, unplanned: 'all' })
  assert.deepEqual(all.elements.filter((e) => e.source === 'actual').map((e) => [e.id, e.kind]), [
    ['code:util/helper.ts', 'component'], ['code:util/helper.ts#Extra', 'interface'], ['code:util/prng.ts', 'component'],
  ])
  assert.equal(all.hidden, 0)
  const none = buildDiagram({ uml, sol, actual: a, unplanned: 'none' })
  assert.equal(none.elements.filter((e) => e.source === 'actual').length, 0)
  assert.equal(none.hidden, 3)
})

test('v3-12: an unplanned dependency between planned modules is drawn at the latest step', () => {
  const { sol, uml } = design([
    { op: 'add', kind: 'decision', label: 'D' },
    { op: 'uml.add', decision: 'decision:d', kind: 'component', name: 'A', code: 'a.ts' },
    { op: 'uml.add', decision: 'decision:d', kind: 'component', name: 'B', code: 'b.ts' },
  ])
  const a = assemble([scanFile('a.ts', "import { b } from './b.ts'\nexport function a() {}"), scanFile('b.ts', 'export function b() {}')], '/r')
  const d = buildDiagram({ uml, sol, actual: a })
  assert.deepEqual(d.relations.map((r) => [r.id, r.from, r.to, r.kind, r.flag, r.source]), [
    ['uml:a|dependency|uml:b', 'uml:a', 'uml:b', 'dependency', 'built-not-planned', 'actual'],
  ])
  assert.equal(d.counts.relations['built-not-planned'], 1)
  assert.equal(buildDiagram({ uml, sol, actual: a, unplanned: 'none' }).relations.length, 0)
})

test('v3-12: deterministic, independent of record order', () => {
  const { sol, uml } = fixture()
  const a = actual()
  const shuffled = { ...uml, elements: Object.fromEntries(Object.entries(uml.elements).reverse()), relations: Object.fromEntries(Object.entries(uml.relations).reverse()) }
  const a2 = assemble(Object.keys(SRC).reverse().map((p) => scanFile(p, SRC[p]!)), '/repo/src')
  assert.deepEqual(buildDiagram({ uml: shuffled, sol, actual: a2, unplanned: 'all' }), buildDiagram({ uml, sol, actual: a, unplanned: 'all' }))
})

test('v3-12: umlPageData has one mermaid per step, three latest variants and marks by Mermaid name', () => {
  const { sol, uml } = fixture()
  const p = umlPageData(uml, sol, actual(), { scannedAt: 5 })
  assert.equal(p.steps.length, 5)
  assert.deepEqual(p.steps.map((s) => s.index), [1, 2, 3, 4, 5])
  assert.deepEqual(p.steps[0]!.drivenBy, ['Panes have no DOM'])
  for (const s of p.steps.slice(0, 4)) assert.ok(!s.mermaid.includes('B_'), `step ${s.index} has no unplanned`)
  assert.ok(p.steps[4]!.mermaid.includes('B_util_helper_ts'))
  assert.equal(p.steps[4]!.mermaid, p.latest.components.mermaid)
  assert.ok(p.latest.all.mermaid.includes('B_util_helper_ts_Extra'))
  assert.ok(!p.latest.none.mermaid.includes('B_'))
  const s3 = p.steps[2]!
  assert.equal(s3.names['uml:gl-renderer'], 'E_gl_renderer')
  assert.deepEqual(s3.marks.E_gl_renderer, { flag: 'removed-but-built', status: 'abandoned', change: 'removed' })
  assert.deepEqual(Object.keys(s3.marks).sort(), Object.values(s3.names).sort())
  assert.equal(p.counts, p.latestDiagram.counts)
  assert.deepEqual(p.scan, { root: '/repo/src', at: 5, truncated: false })
})

test('v3-12: umlPageData merges the oldest steps beyond maxSteps into step 1', () => {
  const ops: DesignOp[] = []
  for (let i = 0; i < 8; i++) {
    ops.push({ op: 'add', kind: 'decision', label: `D${i}` })
    ops.push({ op: 'uml.add', decision: `decision:d${i}`, kind: 'component', name: `C${i}` })
  }
  const { sol, uml } = design(ops)
  const p = umlPageData(uml, sol, null, { maxSteps: 3 })
  assert.deepEqual(p.steps.map((s) => [s.index, s.label]), [[1, '… 6 earlier decisions'], [2, 'D6'], [3, 'D7']])
  assert.ok(p.steps[0]!.mermaid.includes('E_c5') && !p.steps[0]!.mermaid.includes('E_c6'))
  assert.deepEqual(p.steps[0]!.changes.added, ['uml:c0', 'uml:c1', 'uml:c2', 'uml:c3', 'uml:c4', 'uml:c5'])
  const empty = umlPageData(emptyUml(), undefined, null)
  assert.deepEqual(empty.steps, [])
  assert.ok(empty.latest.components.mermaid.startsWith('classDiagram'))
})
