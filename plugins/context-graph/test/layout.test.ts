// Feature 9: deterministic, bounded, warm-started 3D force layout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layout } from '../src/core/layout.ts'
import { applyEvents } from '../src/core/ingest.ts'
import { bestMs, synthGraph } from './helpers.ts'
import type { Vec3 } from '../src/core/types.ts'

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

test('same graph and seed give identical positions', () => {
  const g = synthGraph(4, 5)
  assert.deepEqual(layout(g, {}, { seed: 1 }), layout(g, {}, { seed: 1 }))
})

test('every node gets a finite position within |p| <= 1000', () => {
  const g = synthGraph(6, 8)
  const pos = layout(g, {}, { seed: 7 })
  assert.deepEqual(Object.keys(pos).sort(), Object.keys(g.nodes).sort())
  for (const p of Object.values(pos)) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
    assert.ok(Math.hypot(p.x, p.y, p.z) <= 1000)
  }
})

test('a warm run that adds one node barely moves the old nodes', () => {
  const g = synthGraph(4, 5)
  const prev = layout(g, {}, { seed: 3 })
  const g2 = applyEvents(g, [
    { kind: 'tool_use', id: 'extra', messageId: 'm3', name: 'Read', input: { file_path: '/repo/new.ts' } },
  ])
  const next = layout(g2, prev, { seed: 3 })
  for (const id of Object.keys(prev)) assert.ok(dist(prev[id]!, next[id]!) < 5, `${id} moved ${dist(prev[id]!, next[id]!)}`)
  assert.ok(next['tool:extra'], 'new node placed')
})

test('connected nodes end closer on average than unconnected pairs', () => {
  const g = synthGraph(5, 6)
  const pos = layout(g, {}, { seed: 11 })
  const linked = new Set(g.edges.map((e) => `${e.from}|${e.to}`))
  let conn = 0, nConn = 0, un = 0, nUn = 0
  const ids = Object.keys(g.nodes)
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const d = dist(pos[ids[i]!]!, pos[ids[j]!]!)
      if (linked.has(`${ids[i]}|${ids[j]}`) || linked.has(`${ids[j]}|${ids[i]}`)) (conn += d), nConn++
      else (un += d), nUn++
    }
  assert.ok(conn / nConn < un / nUn, `${conn / nConn} vs ${un / nUn}`)
})

test('out-of-window nodes sit further out than in-window ones', () => {
  const g0 = synthGraph(3, 4)
  const g = applyEvents(g0, [{ kind: 'compact', id: 'c1', summaryChars: 2000 }, { kind: 'prompt', id: 'after', text: 'next' }])
  const pos = layout(g, {}, { seed: 2 })
  const r = (inWin: boolean) => {
    const ns = Object.values(g.nodes).filter((n) => n.inWindow === inWin)
    return ns.reduce((s, n) => s + Math.hypot(pos[n.id]!.x, pos[n.id]!.y, pos[n.id]!.z), 0) / ns.length
  }
  assert.ok(r(false) > r(true))
})

test('300 nodes x 30 iterations completes in under 200 ms', () => {
  const g = synthGraph(30, 9, 60)
  const n = Object.keys(g.nodes).length
  assert.ok(n >= 280, `only ${n} nodes`)
  const ms = bestMs(() => layout(g, {}, { seed: 1, iterations: 30 }), 3, 1)
  assert.ok(ms < 200, `best ${ms.toFixed(1)} ms`)
})
