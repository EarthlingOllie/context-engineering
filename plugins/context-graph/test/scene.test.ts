// Features 3 (radius half) and 11: buildScene sizes nodes by tokens and frames the blast radius.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScene } from '../src/core/scene.ts'
import { blastRadius } from '../src/core/blast.ts'
import { layout } from '../src/core/layout.ts'
import { synthGraph } from './helpers.ts'
import type { Graph, GraphNode, Vec3 } from '../src/core/types.ts'
import { applyOps, emptyModel } from '../src/core/solution.ts'
import { relevance } from '../src/core/relevance.ts'
import { health } from '../src/core/health.ts'
import { layoutLayers } from '../src/core/layers.ts'

const size = { w: 800, h: 600 }
const view = { yaw: 0, pitch: 0, distance: 0, fov: 50 }

const handGraph = (nodes: [string, number][]): Graph => ({
  nodes: Object.fromEntries(nodes.map(([id, tokens], i): [string, GraphNode] => [id, { id, kind: 'tool', label: id, tokens, seq: i, inWindow: true }])),
  edges: [],
  latestPromptId: null,
  latestTurnId: null,
  promptTurnId: null,
  seq: nodes.length,
  meta: { skipped: 0 },
})

test('at equal depth, more tokens never means a smaller radius; radius stays in [2,40]', () => {
  const g = handGraph([['small', 10], ['big', 10_000], ['huge', 1e9], ['tiny', 1]])
  const positions: Record<string, Vec3> = { small: { x: -5, y: 0, z: 0 }, big: { x: 5, y: 0, z: 0 }, huge: { x: 0, y: 5, z: 0 }, tiny: { x: 0, y: -5, z: -400 } }
  const blast = { weights: {}, hops: {}, seeds: [], tokens: 0, centroidIds: ['small', 'big'] }
  const s = buildScene({ graph: g, positions, blast, view }, size)
  const by = Object.fromEntries(s.items.map((i) => [i.id, i]))
  assert.ok(Math.abs(by.small!.depth - by.big!.depth) < 1e-6)
  assert.ok(by.big!.r >= by.small!.r)
  for (const i of s.items) assert.ok(i.r >= 2 && i.r <= 40, `${i.id} r=${i.r}`)
  assert.equal(by.huge!.r, 40)
})

const screenCentroid = (s: ReturnType<typeof buildScene>, ids: string[]) => {
  const items = s.items.filter((i) => ids.includes(i.id))
  assert.equal(items.length, ids.length, 'every centroid node is drawn')
  return { x: items.reduce((a, i) => a + i.x, 0) / items.length, y: items.reduce((a, i) => a + i.y, 0) / items.length, items }
}

test('the camera centres the blast-radius centroid and keeps every centroid node in frame', () => {
  const g = synthGraph(6, 5)
  const positions = layout(g, {}, { seed: 5 })
  const blast = blastRadius(g, [])
  assert.ok(blast.centroidIds.length >= 2)
  const s = buildScene({ graph: g, positions, blast, view: { ...view, yaw: 35, pitch: 20 } }, size)
  const c = screenCentroid(s, blast.centroidIds)
  assert.ok(Math.abs(c.x - 400) <= 0.05 * 800 && Math.abs(c.y - 300) <= 0.05 * 600, JSON.stringify(c))
  for (const i of c.items) assert.ok(i.x >= 0 && i.x <= 800 && i.y >= 0 && i.y <= 600, `${i.id} off frame`)
})

test('refocusing on a far-away model seed centres the new set instead', () => {
  const g = synthGraph(6, 5)
  const positions = layout(g, {}, { seed: 5 })
  const oldFile = 'file:/repo/f0.ts'
  const latest = blastRadius(g, [])
  const blast = blastRadius(g, [{ id: oldFile, source: 'model' }])
  assert.notDeepEqual(blast.centroidIds, latest.centroidIds)
  const focus = { seeds: [{ id: oldFile, source: 'model' as const }], note: 'why f0' }
  const s = buildScene({ graph: g, positions, blast, view, focus }, size)
  const c = screenCentroid(s, blast.centroidIds)
  assert.ok(Math.abs(c.x - 400) <= 40 && Math.abs(c.y - 300) <= 30, JSON.stringify(c))
  const seed = s.items.find((i) => i.id === oldFile)!
  assert.equal(seed.seed, 'model')
  assert.equal(s.legend.note, 'why f0')
})

test('items are ordered far to near, edges carry the weaker endpoint weight, legend sums tokens', () => {
  const g = synthGraph(3, 3)
  const positions = layout(g, {}, { seed: 1 })
  const blast = blastRadius(g, [])
  const s = buildScene({ graph: g, positions, blast, view }, size)
  for (let i = 1; i < s.items.length; i++) assert.ok(s.items[i - 1]!.depth >= s.items[i]!.depth)
  assert.ok(s.edges.length > 0)
  for (const e of s.edges) assert.ok(e.weight >= 0 && e.weight <= 1)
  assert.equal(s.legend.tokensInRadius, blast.tokens)
  assert.equal(s.legend.totalTokens, Object.values(g.nodes).filter((n) => n.inWindow).reduce((a, n) => a + n.tokens, 0))
  const prompt = s.items.find((i) => i.id === g.latestPromptId)!
  assert.equal(prompt.weight, 1)
  assert.equal(prompt.seed, 'prompt')
})

test('the auto-fit keeps every in-window node (with its radius) inside the frame', async () => {
  const { readFileSync } = await import('node:fs')
  const { buildGraph } = await import('../src/core/ingest.ts')
  const g = buildGraph(readFileSync(new URL('./fixtures/session-small.jsonl', import.meta.url), 'utf8'))
  const positions = layout(g, {}, { seed: 1 })
  const blast = blastRadius(g, [])
  const s = buildScene({ graph: g, positions, blast, view: { yaw: 30, pitch: 20, distance: 0, fov: 50 } }, { w: 640, h: 480 })
  for (const n of Object.values(g.nodes).filter((n) => n.inWindow)) {
    const i = s.items.find((i) => i.id === n.id)
    assert.ok(i, `${n.id} drawn`)
    assert.ok(i.x - i.r >= 0 && i.x + i.r <= 640 && i.y - i.r >= 0 && i.y + i.r <= 480 - 16, `${n.id} off frame: ${i.x},${i.y} r${i.r}`)
  }
})

// ---- v2-10: layered scene ----
import { buildLayeredScene, KIND_COLORS } from '../src/core/scene.ts'
import { layeredFixture, layeredInputs } from './helpers.ts'

test('v2-10: items carry layer, shape by kind, status, health and isNew', () => {
  const { scene } = layeredFixture()
  const by = Object.fromEntries(scene.items.map((i) => [i.id, i]))
  const shapes: Record<string, string> = {
    'goal:show-the-context-window-as-a-graph': 'goal', 'component:pane': 'circle', 'decision:svg-projection': 'square',
    'requirement:readable-in-30-seconds': 'triangle', 'constraint:no-webgl-in-panes': 'diamond', 'assumption:transcript-is-on-disk': 'diamond',
    'dependency:three-js-maths': 'hex', 'risk:pane-always-dark': 'cross', 'question:do-panes-work-on-the-web': 'question',
  }
  for (const [id, shape] of Object.entries(shapes)) {
    assert.equal(by[id]?.layer, 'solution', id)
    assert.equal(by[id]!.shape, shape, id)
  }
  assert.equal(by['question:do-panes-work-on-the-web']!.status, 'open')
  assert.equal(by['risk:pane-always-dark']!.status, 'resolved')
  assert.equal(by['decision:webgl-in-pane']!.status, 'abandoned')
  assert.equal(by['constraint:no-webgl-in-panes']!.health, 'in-window')
  assert.equal(by['dependency:three-js-maths']!.health, 'never-loaded')
  assert.equal(by['question:do-panes-work-on-the-web']!.isNew, true)
  assert.equal(by['question:use-a-worker']!.isNew, true)
  assert.equal(by['goal:show-the-context-window-as-a-graph']!.isNew, false)
  assert.equal(by['turn:m1']?.layer, 'evidence')
  assert.equal(by['turn:m1']!.shape, undefined)
})

test('v2-10: layers option filters items and edges by layer', () => {
  const sol = layeredFixture('solution').scene
  assert.ok(sol.items.length >= 14)
  assert.ok(sol.items.every((i) => i.layer === 'solution'))
  assert.ok(sol.edges.every((e) => e.layer === 'solution' && e.kind !== 'supported-by' && e.kind !== 'evidence'))
  const ev = layeredFixture('evidence').scene
  assert.ok(ev.items.length > 20)
  assert.ok(ev.items.every((i) => i.layer === 'evidence'))
  assert.ok(ev.edges.every((e) => e.kind === 'evidence'))
})

test('v2-10: labels for goal, components, decisions and open questions; at most 6 evidence labels', () => {
  const { scene } = layeredFixture()
  const labelled = new Set(scene.items.filter((i) => i.labelled).map((i) => i.id))
  for (const id of ['goal:show-the-context-window-as-a-graph', 'component:pane', 'component:export-page', 'decision:svg-projection', 'decision:free-turn-hops', 'question:do-panes-work-on-the-web'])
    assert.ok(labelled.has(id), id)
  assert.ok(!labelled.has('question:use-a-worker'), 'abandoned question is not open')
  assert.ok(scene.items.filter((i) => i.labelled && i.layer === 'solution').length <= 24)
  const ev = scene.items.filter((i) => i.labelled && i.layer === 'evidence').length
  assert.ok(ev >= 1 && ev <= 6, `evidence labels ${ev}`)
})

test('v2-10: solution labels capped at 24 in a large model', () => {
  const ops = [{ op: 'add' as const, kind: 'goal' as const, label: 'G' }, ...Array.from({ length: 40 }, (_, i) => ({ op: 'add' as const, kind: 'component' as const, label: `C${i}` }))]
  const model = applyOps(emptyModel(), ops).model
  const g = synthGraph(1, 1)
  const positions = layoutLayers(model, g, { solution: {}, evidence: {} }, { seed: 1 })
  const s = buildLayeredScene({ model, graph: g, positions, relevance: relevance(model, g, { seeds: [] }, blastRadius(g, [])), health: health(model, g), view, layers: 'both' }, size)
  const lab = s.items.filter((i) => i.labelled && i.layer === 'solution')
  assert.equal(lab.length, 24)
  assert.ok(lab.some((i) => i.kind === 'goal'))
})

test('v2-10: supported-by edges are kind supported-by; solution edges keep their kind', () => {
  const { scene } = layeredFixture()
  const kinds = new Set(scene.edges.map((e) => e.kind))
  for (const k of ['supported-by', 'depends-on', 'constrains', 'decided-by', 'contradicts', 'evidence']) assert.ok(kinds.has(k as never), k)
  const sb = scene.edges.filter((e) => e.kind === 'supported-by')
  assert.ok(sb.some((e) => e.from === 'constraint:no-webgl-in-panes' && e.to === 'tool:u1'))
})

test('v2-10: every solution kind colour has >= 3:1 contrast on #0d1117 and #ffffff', () => {
  const lum = (c: number) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f((c >> 16) & 255) + 0.7152 * f((c >> 8) & 255) + 0.0722 * f(c & 255)
  }
  const ratio = (a: number, b: number) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  for (const k of ['goal', 'component', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'decision', 'question'] as const) {
    const c = KIND_COLORS[k]
    assert.equal(typeof c, 'number', k)
    assert.ok(ratio(c, 0x0d1117) >= 3, `${k} on dark ${ratio(c, 0x0d1117)}`)
    assert.ok(ratio(c, 0xffffff) >= 3, `${k} on white ${ratio(c, 0xffffff)}`)
  }
})

test('v2-10: every solution node fits inside the frame', () => {
  const { scene } = layeredFixture()
  for (const i of scene.items.filter((x) => x.layer === 'solution'))
    assert.ok(i.x - i.r >= 0 && i.x + i.r <= scene.width && i.y - i.r >= 0 && i.y + i.r <= scene.height, i.id)
})

test('v2-10: the layered scene fills the frame (both layers span >= 90% of the free height or width, all inside)', () => {
  for (const view of [{ yaw: 30, pitch: 20, distance: 0, fov: 50 }, { yaw: 20, pitch: 35, distance: 0, fov: 50 }]) {
    const { model, graph, positions, relevance: rel, health: hl } = layeredInputs()
    const s = buildLayeredScene({ model, graph, positions, relevance: rel, health: hl, view, layers: 'both' }, size)
    const xs = s.items.flatMap((i) => [i.x - i.r, i.x + i.r]), ys = s.items.flatMap((i) => [i.y - i.r, i.y + i.r])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    assert.ok(x0 >= 0 && x1 <= size.w && y0 >= 18 && y1 <= size.h - 16, `inside: ${[x0, x1, y0, y1].map(Math.round)}`)
    const fill = Math.max((x1 - x0) / size.w, (y1 - y0) / (size.h - 34))
    assert.ok(fill >= 0.9, `fill ${fill.toFixed(2)} at pitch ${view.pitch}`)
  }
})

test('v2-10: constraints and risks are labelled too, after goal, questions, components and decisions', () => {
  const { scene } = layeredFixture()
  const lab = scene.items.filter((i) => i.labelled && i.layer === 'solution')
  assert.ok(lab.some((i) => i.kind === 'constraint'), 'a constraint label')
  assert.ok(lab.some((i) => i.kind === 'risk'), 'a risk label')
})
