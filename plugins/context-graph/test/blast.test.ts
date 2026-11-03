// blast: Graph + seeds -> BlastRadius (design.md 4.2, features 7-8).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blastRadius } from '../src/core/blast.ts'
import type { Graph, GraphEdge, GraphEvent, GraphNode, NodeKind } from '../src/core/types.ts'

let seq = 0
const node = (id: string, kind: NodeKind, tokens: number, inWindow = true): GraphNode => ({ id, kind, label: id, tokens, seq: ++seq, inWindow })
const graph = (nodes: GraphNode[], edges: GraphEdge[], latestPromptId: string | null): Graph => ({
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  edges,
  latestPromptId,
  latestTurnId: null,
  promptTurnId: null,
  seq,
  meta: { skipped: 0 },
})

// prompt -> turn -> tool -> file <- tool2
const chain = () =>
  graph(
    [node('p', 'prompt', 10), node('t', 'turn', 20), node('x', 'tool', 30), node('f', 'file', 40), node('x2', 'tool', 50)],
    [
      { from: 'p', to: 't', kind: 'prompt-turn' },
      { from: 't', to: 'x', kind: 'turn-tool' },
      { from: 'x', to: 'f', kind: 'tool-file' },
      { from: 'x2', to: 'f', kind: 'tool-file' },
    ],
    'p',
  )

test('feature 7: weights fall off by hop from the latest prompt and stop at maxHops', () => {
  const b = blastRadius(chain(), [], { maxHops: 3 })
  assert.deepEqual(b.weights, { p: 1, t: 0.5, x: 0.25, f: 0.125 })
  assert.deepEqual(b.hops, { p: 0, t: 1, x: 2, f: 3 })
  assert.equal(b.weights.x2, undefined)
  assert.equal(b.tokens, 10 + 20 + 30 + 40)
  assert.deepEqual(b.seeds, ['p'])
})

test('feature 7: the result does not depend on edge order', () => {
  const g = chain()
  const a = blastRadius(g, [])
  const shuffled = { ...g, edges: [g.edges[3]!, g.edges[1]!, g.edges[0]!, g.edges[2]!] }
  assert.deepEqual(blastRadius(shuffled, []), a)
})

test('feature 7: no seeds and no latest prompt gives empty weights', () => {
  const g = { ...chain(), latestPromptId: null }
  const b = blastRadius(g, [])
  assert.deepEqual(b.weights, {})
  assert.equal(b.tokens, 0)
  assert.deepEqual(b.centroidIds, [])
})

test('feature 8: model seeds merge with the prompt seed by max weight; out-of-window capped at 0.1', () => {
  const g = graph(
    [
      node('old', 'prompt', 5, false),
      node('oldturn', 'turn', 5, false),
      node('p', 'prompt', 10),
      node('t', 'turn', 20),
      node('x', 'tool', 30),
      node('f', 'file', 40, false),
      node('y', 'tool', 30),
    ],
    [
      { from: 'old', to: 'oldturn', kind: 'prompt-turn' },
      { from: 'oldturn', to: 'f', kind: 'turn-tool' },
      { from: 'p', to: 't', kind: 'prompt-turn' },
      { from: 't', to: 'x', kind: 'turn-tool' },
      { from: 'x', to: 'y', kind: 'turn-tool' },
      { from: 'y', to: 'f', kind: 'tool-file' },
    ],
    'p',
  )
  const b = blastRadius(g, [{ id: 'p', source: 'prompt' }, { id: 'y', source: 'model' }])
  assert.equal(b.weights.p, 1)
  assert.equal(b.weights.y, 1)
  assert.equal(b.weights.x, 0.5, 'max of 0.25 (from p) and 0.5 (from y)')
  assert.equal(b.weights.t, 0.5)
  assert.equal(b.weights.f, 0.1, 'out-of-window capped')
  assert.equal(b.weights.oldturn, 0.1)
  assert.deepEqual([...b.centroidIds].sort(), ['p', 't', 'x', 'y'])
  assert.deepEqual([...b.seeds].sort(), ['p', 'y'])
})

test('feature 8: an out-of-window model seed still caps at 0.1', () => {
  const g = graph([node('p', 'prompt', 1), node('z', 'file', 1, false)], [], 'p')
  const b = blastRadius(g, [{ id: 'z', source: 'model' }])
  assert.equal(b.weights.z, 0.1)
  assert.equal(b.weights.p, undefined, 'explicit seeds replace the latest-prompt default')
})

test('the latest prompt reaches every tool and file of its turns, however long the turn chain', async () => {
  const { applyEvents, emptyGraph } = await import('../src/core/ingest.ts')
  const evs: GraphEvent[] = [{ kind: 'prompt', id: 'q', text: 'long task' }]
  for (let i = 0; i < 12; i++) {
    evs.push({ kind: 'assistant', messageId: `m${i}`, text: `step ${i}` })
    evs.push({ kind: 'tool_use', id: `u${i}`, messageId: `m${i}`, name: 'Read', input: { file_path: `/repo/f${i}.ts` } })
    evs.push({ kind: 'tool_result', toolUseId: `u${i}`, chars: 400, isError: false })
  }
  const g = applyEvents(emptyGraph(), evs)
  const b = blastRadius(g, [])
  for (let i = 0; i < 12; i++) {
    assert.equal(b.hops[`turn:m${i}`], 1, `turn m${i} is one hop from its prompt`)
    assert.equal(b.hops[`tool:u${i}`], 2, `tool u${i} is two hops from its prompt`)
    assert.equal(b.hops[`file:/repo/f${i}.ts`], 3, `file f${i} is three hops from its prompt`)
    assert.equal(b.weights[`tool:u${i}`], 0.25)
  }
})

test('v2-24: solution seeds in focus do not change the blast radius (only-solution seeds fall back to the prompt)', () => {
  const g = chain()
  const auto = blastRadius(g, [])
  assert.deepEqual(blastRadius(g, [{ id: 'question:x', source: 'model' }, { id: 'goal:g', source: 'model' }]), auto)
  const withTool = blastRadius(g, [{ id: 'x2', source: 'model' }])
  assert.deepEqual(blastRadius(g, [{ id: 'x2', source: 'model' }, { id: 'question:x', source: 'model' }]), withTool)
})
