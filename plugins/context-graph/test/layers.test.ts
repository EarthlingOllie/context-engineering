// layers: layered 3D layout of the solution and evidence layers (v2 design.md 4.5, feature v2-09).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyOps, emptyModel } from '../src/core/solution.ts'
import { layoutLayers } from '../src/core/layers.ts'
import { synthGraph } from './helpers.ts'
import type { SolOp, Vec3 } from '../src/core/types.ts'

// Independent statement of the spec: ring radius per kind band, evidence plane.
const RING: Record<string, number> = {
  component: 120, decision: 200,
  requirement: 280, constraint: 280, assumption: 280, dependency: 280, risk: 280, question: 280,
}
const EVIDENCE_Y = -300
const hr = (p: Vec3) => Math.hypot(p.x, p.z)

const g = synthGraph(4, 5)
const model = applyOps(emptyModel(), [
  { op: 'add', kind: 'goal', label: 'Show the solution', evidence: ['prompt:p0'] },
  { op: 'add', kind: 'component', label: 'Pane' },
  { op: 'add', kind: 'component', label: 'Export' },
  { op: 'add', kind: 'constraint', label: 'No WebGL in pane', evidence: ['turn:m1'] },
  { op: 'add', kind: 'requirement', label: 'Readable in 30s' },
  { op: 'add', kind: 'decision', label: 'SVG in pane' },
  { op: 'add', kind: 'question', label: 'Which camera?' },
  { op: 'add', kind: 'assumption', label: 'Old idea' },
  { op: 'abandon', id: 'assumption:old-idea', reason: 'wrong' },
  { op: 'link', from: 'component:pane', to: 'constraint:no-webgl-in-pane', kind: 'constrains' },
  { op: 'link', from: 'component:pane', to: 'decision:svg-in-pane', kind: 'decided-by' },
]).model

test('v2-09: goal at origin, solution nodes on their kind ring in the y~0 plane, abandoned pushed out', () => {
  const out = layoutLayers(model, g, { solution: {}, evidence: {} }, { seed: 1 })
  assert.deepEqual(out.solution['goal:show-the-solution'], { x: 0, y: 0, z: 0 })
  for (const nd of Object.values(model.nodes)) {
    if (nd.kind === 'goal') continue
    const p = out.solution[nd.id]!
    assert.ok(p, `${nd.id} placed`)
    assert.ok(Math.abs(p.y) <= 20, `${nd.id} y ${p.y}`)
    const want = RING[nd.kind]! + (nd.status === 'abandoned' ? 60 : 0)
    assert.ok(Math.abs(hr(p) - want) <= 25, `${nd.id} r ${hr(p)} want ${want}`)
  }
  assert.ok(Math.abs(hr(out.solution['assumption:old-idea']!) - 340) <= 25)
})

test('v2-09: evidence nodes sit on the evidence plane within radius 320', () => {
  const out = layoutLayers(model, g, { solution: {}, evidence: {} }, { seed: 1 })
  assert.deepEqual(Object.keys(out.evidence).sort(), Object.keys(g.nodes).sort())
  for (const [id, p] of Object.entries(out.evidence)) {
    assert.ok(Math.abs(p.y - EVIDENCE_Y) <= 40, `${id} y ${p.y}`)
    assert.ok(hr(p) <= 320, `${id} r ${hr(p)}`)
  }
})

test('v2-09: output is finite, bounded and deterministic for the same input and seed', () => {
  const a = layoutLayers(model, g, { solution: {}, evidence: {} }, { seed: 5 })
  const b = layoutLayers(model, g, { solution: {}, evidence: {} }, { seed: 5 })
  assert.deepEqual(a, b)
  for (const p of [...Object.values(a.solution), ...Object.values(a.evidence)]) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
    assert.ok(Math.hypot(p.x, p.y, p.z) <= 1000)
  }
})

test('v2-09: warm start with one added node moves no existing solution node more than 15 units', () => {
  const prev = layoutLayers(model, g, { solution: {}, evidence: {} }, { seed: 2 })
  const m2 = applyOps(model, [
    { op: 'add', kind: 'risk', label: 'Large SVG' },
    { op: 'link', from: 'component:pane', to: 'risk:large-svg', kind: 'constrains' },
  ]).model
  const next = layoutLayers(m2, g, prev, { seed: 2 })
  for (const id of Object.keys(prev.solution)) {
    const a = prev.solution[id]!, b = next.solution[id]!
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
    assert.ok(d <= 15, `${id} moved ${d}`)
  }
  assert.ok(Math.abs(hr(next.solution['risk:large-svg']!) - 280) <= 25)
})

test('v2-09: an empty model still lays out the evidence layer', () => {
  const out = layoutLayers(emptyModel(), g, { solution: {}, evidence: {} })
  assert.deepEqual(out.solution, {})
  assert.equal(Object.keys(out.evidence).length, Object.keys(g.nodes).length)
})

test('v2-09: 200 solution + 300 evidence nodes lay out in under 60 ms (median of 5)', () => {
  const ops: SolOp[] = [{ op: 'add', kind: 'goal', label: 'Big' }]
  const kinds = ['component', 'decision', 'requirement', 'constraint', 'risk', 'question'] as const
  for (let i = 0; i < 199; i++) ops.push({ op: 'add', kind: kinds[i % kinds.length]!, label: `n${i}`, id: `${kinds[i % kinds.length]}:n${i}` })
  for (let i = 0; i < 150; i++) ops.push({ op: 'link', from: `${kinds[i % kinds.length]}:n${i}`, to: `${kinds[(i + 1) % kinds.length]}:n${i + 1}`, kind: 'depends-on' })
  const big = applyOps(emptyModel(), ops).model
  assert.equal(Object.keys(big.nodes).length, 200)
  const gg = synthGraph(36, 5, 48) // 36 prompts + 36 turns + 180 tools + 48 files = 300
  assert.equal(Object.keys(gg.nodes).length, 300)
  // two warm-up runs so the JIT is not timed (the median flaked at ~63 ms cold under --test-concurrency=2)
  for (let k = 0; k < 2; k++) layoutLayers(big, gg, { solution: {}, evidence: {} }, { seed: 1 })
  const times: number[] = []
  for (let k = 0; k < 5; k++) {
    const t = performance.now()
    layoutLayers(big, gg, { solution: {}, evidence: {} }, { seed: 1 })
    times.push(performance.now() - t)
  }
  times.sort((a, b) => a - b)
  assert.ok(times[2]! < 60, `median ${times[2]} ms`)
})
