// Features 3 (radius half) and 11: buildScene sizes nodes by tokens and frames the blast radius.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScene } from '../src/core/scene.ts'
import { blastRadius } from '../src/core/blast.ts'
import { layout } from '../src/core/layout.ts'
import { synthGraph } from './helpers.ts'
import type { Graph, GraphNode, Vec3 } from '../src/core/types.ts'

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
