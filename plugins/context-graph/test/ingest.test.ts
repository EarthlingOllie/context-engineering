// ingest: transcript JSONL / GraphEvents -> Graph (design.md 4.1, features 1-6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyEvents, buildGraph, emptyGraph, rowsToEvents } from '../src/core/ingest.ts'
import type { Graph, GraphEvent, GraphNode, NodeKind } from '../src/core/types.ts'

const fixture = readFileSync(new URL('./fixtures/session-small.jsonl', import.meta.url), 'utf8')
const ofKind = (g: Graph, k: NodeKind): GraphNode[] => Object.values(g.nodes).filter((n) => n.kind === k)

test('feature 1: fixture transcript becomes a graph of prompts, turns, tools, files, system and compaction', () => {
  const g = buildGraph(fixture)
  assert.equal(ofKind(g, 'prompt').length, 2)
  assert.ok(ofKind(g, 'turn').length >= 2)
  assert.equal(ofKind(g, 'tool').length, 5)
  assert.ok(ofKind(g, 'file').length >= 1)
  assert.ok(ofKind(g, 'system').length >= 1)
  assert.equal(ofKind(g, 'compaction').length, 1)
  assert.equal(g.latestPromptId, 'prompt:p2')
  assert.equal(g.meta.skipped, 1)
})

const asstRow = (uuid: string, mid: string, block: unknown, extra: Record<string, unknown> = {}) => ({
  type: 'assistant', uuid, message: { id: mid, role: 'assistant', content: [block], usage: { input_tokens: 2, cache_read_input_tokens: 100, output_tokens: 77 } }, ...extra,
})

test('feature 2: assistant usage is counted once per message.id; sidechain and metadata rows add nothing', () => {
  const rows = [
    { type: 'user', uuid: 'p', message: { role: 'user', content: 'hi' } },
    asstRow('a', 'm1', { type: 'thinking', thinking: '' }),
    asstRow('b', 'm1', { type: 'text', text: '' }),
    asstRow('c', 'm1', { type: 'text', text: '' }),
  ]
  const g = applyEvents(emptyGraph(), rowsToEvents(rows))
  const turns = ofKind(g, 'turn')
  assert.equal(turns.length, 1)
  assert.equal(turns[0]!.meta?.outputTokens, 77)
  assert.equal(turns[0]!.tokens, 77)

  const before = Object.keys(g.nodes).length
  const noise = [
    asstRow('s', 'm9', { type: 'tool_use', id: 'x', name: 'Read', input: { file_path: '/s.ts' } }, { isSidechain: true }),
    { type: 'queue-operation', operation: 'enqueue', content: 'x' },
    { type: 'last-prompt', lastPrompt: 'x', leafUuid: 'a' },
    { type: 'ai-title', aiTitle: 'x' },
    { type: 'tools-used', tools: ['Read'] },
    { type: 'atis-latch', atis: '' },
  ]
  const g2 = applyEvents(g, rowsToEvents(noise))
  assert.equal(Object.keys(g2.nodes).length, before)
})

test('feature 3 (ingest): every node has integer tokens >= 1 and a 4000-char result gives its tool >= 1000 tokens', () => {
  const g = buildGraph(fixture)
  for (const n of Object.values(g.nodes)) {
    assert.ok(Number.isInteger(n.tokens) && n.tokens >= 1, `${n.id} tokens=${n.tokens}`)
  }
  assert.ok(g.nodes['tool:t1']!.tokens >= 1000)
})

test('feature 4: prompt->turn, turn->tool, tool->file edges; a shared file has one node; no dangling edges', () => {
  const g = buildGraph(fixture)
  const has = (from: string, to: string) => g.edges.some((e) => e.from === from && e.to === to)
  for (const p of ofKind(g, 'prompt')) assert.ok(g.edges.some((e) => e.from === p.id && e.kind === 'prompt-turn'), p.id)
  for (const t of ofKind(g, 'tool')) assert.ok(g.edges.some((e) => e.to === t.id && e.kind === 'turn-tool'), t.id)
  assert.ok(has('prompt:p1', 'turn:msg_1'))
  assert.ok(has('turn:msg_1', 'tool:t1'))
  assert.ok(has('tool:t1', 'file:/repo/a.ts'))
  assert.ok(has('tool:t2', 'file:/repo/a.ts'))
  assert.ok(has('tool:t5', 'file:/repo/b.ts'))
  assert.equal(g.edges.filter((e) => e.to === 'file:/repo/a.ts').length, 2)
  assert.equal(ofKind(g, 'file').filter((f) => f.meta?.path === '/repo/a.ts').length, 1)
  assert.equal(g.nodes['file:/repo/src'], undefined, 'Grep on a directory adds no file node')
  for (const e of g.edges) assert.ok(g.nodes[e.from] && g.nodes[e.to], `${e.from}->${e.to}`)
})

test('feature 5: a compact_boundary puts earlier nodes out of the window and adds one compaction node', () => {
  const g = buildGraph(fixture)
  const c = ofKind(g, 'compaction')
  assert.equal(c.length, 1)
  assert.ok(c[0]!.tokens >= 1)
  assert.equal(c[0]!.tokens, 500, '2000-char summary / 4')
  for (const n of Object.values(g.nodes)) {
    if (n.kind === 'compaction') continue
    assert.equal(n.inWindow, n.seq > c[0]!.seq, `${n.id} seq=${n.seq}`)
  }
})

test('feature 5: a legacy {type:"summary"} row compacts the same way', () => {
  const rows = [
    { type: 'user', uuid: 'p1', message: { role: 'user', content: 'one' } },
    asstRow('a', 'm1', { type: 'text', text: 'ok' }),
    { type: 'summary', summary: 'earlier talk', leafUuid: 'a' },
    { type: 'user', uuid: 'p2', message: { role: 'user', content: 'two' } },
  ]
  const g = applyEvents(emptyGraph(), rowsToEvents(rows))
  assert.equal(ofKind(g, 'compaction').length, 1)
  assert.equal(g.nodes['prompt:p1']!.inWindow, false)
  assert.equal(g.nodes['turn:m1']!.inWindow, false)
  assert.equal(g.nodes['prompt:p2']!.inWindow, true)
})

test('feature 6: maxNodes evicts out-of-window nodes first and keeps the latest prompt and its neighbours', () => {
  const evs: GraphEvent[] = [{ kind: 'prompt', id: 'old', text: 'old question' }, { kind: 'assistant', messageId: 'm0', text: 'old' }]
  for (let i = 0; i < 20; i++) evs.push({ kind: 'tool_use', id: `o${i}`, messageId: 'm0', name: 'Read', input: { file_path: `/old/${i}.ts` } })
  evs.push({ kind: 'compact', id: 'c', summaryChars: 400 })
  evs.push({ kind: 'prompt', id: 'new', text: 'new question' }, { kind: 'assistant', messageId: 'm1', text: 'thinking' })
  for (let i = 0; i < 200; i++) evs.push({ kind: 'tool_use', id: `n${i}`, messageId: 'm1', name: 'Bash', input: { command: `echo ${i}` } })
  const g = applyEvents(emptyGraph(), evs, { maxNodes: 50 })
  const nodes = Object.values(g.nodes)
  assert.ok(nodes.length <= 50, `${nodes.length} nodes`)
  assert.equal(nodes.filter((n) => !n.inWindow).length, 0, 'every out-of-window node went before in-window ones')
  assert.ok(g.nodes['prompt:new'])
  assert.ok(g.nodes['turn:m1'], 'hop-1 neighbour kept')
  assert.ok(g.nodes['tool:n199'], 'newest tool kept')
  assert.equal(g.nodes['tool:n0'], undefined, 'oldest tool evicted')
  for (const e of g.edges) assert.ok(g.nodes[e.from] && g.nodes[e.to], `${e.from}->${e.to}`)
})

test('feature 1: the parser never throws on garbage', () => {
  const g = buildGraph('\n\nnull\n[]\n{"type":"user"}\n{"type":"assistant","message":5}\n{bad\n')
  assert.equal(Object.keys(g.nodes).length, 0)
  assert.equal(g.meta.skipped, 1)
})
