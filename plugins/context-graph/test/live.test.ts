// Feature 18 (core half): session.append rows -> graph events, grouping one response's block rows into one turn.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendToEvents, emptyCursor, matchNodes, enrichTool } from '../src/core/live.ts'
import { applyEvents, emptyGraph } from '../src/core/ingest.ts'

const user = (uuid: string, content: unknown, extra = {}) => ({ uuid, message: { type: 'user', role: 'user', content }, ...extra })
const asst = (uuid: string, content: unknown[]) => ({ uuid, message: { type: 'assistant', role: 'assistant', content } })

test('a prompt, two assistant block rows and a tool result grow prompt + one turn + tool + file', () => {
  let cursor = emptyCursor()
  let g = emptyGraph()
  for (const row of [
    user('u1', [{ type: 'text', text: 'fix a.ts' }]),
    asst('a1', [{ type: 'text', text: 'Reading it.' }]),
    asst('a2', [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: '/a.ts' } }]),
    user('u2', [{ type: 'tool_result', tool_use_id: 'tu1', content: 'x'.repeat(400) }]),
  ]) {
    const r = appendToEvents(row, cursor)
    cursor = r.cursor
    g = applyEvents(g, r.events)
  }
  const kinds = Object.values(g.nodes).map((n) => n.kind).sort()
  assert.deepEqual(kinds, ['file', 'prompt', 'tool', 'turn'])
  assert.equal(g.latestPromptId, 'prompt:u1')
  assert.ok(g.nodes['tool:tu1']!.tokens >= 100)
  assert.ok(g.edges.some((e) => e.from === 'prompt:u1' && e.to.startsWith('turn:')))
})

test('a new assistant response after a tool result is a new turn', () => {
  let cursor = emptyCursor()
  const ids: string[] = []
  for (const row of [asst('a1', [{ type: 'text', text: 'one' }]), user('u2', [{ type: 'tool_result', tool_use_id: 't', content: '' }]), asst('a3', [{ type: 'text', text: 'two' }])]) {
    const r = appendToEvents(row, cursor)
    cursor = r.cursor
    for (const e of r.events) if (e.kind === 'assistant') ids.push(e.messageId)
  }
  assert.equal(new Set(ids).size, 2)
})

test('subagent rows, notices and non-objects add nothing; meta user rows are injected context', () => {
  assert.deepEqual(appendToEvents({ ...user('s', 'hi'), agentId: 'ag1' }, emptyCursor()).events, [])
  assert.deepEqual(appendToEvents({ uuid: 'n', message: { type: 'system', content: [{ type: 'text', text: 'note' }] } }, emptyCursor()).events, [])
  assert.deepEqual(appendToEvents(null, emptyCursor()).events, [])
  assert.deepEqual(appendToEvents({ uuid: 'm', message: { type: 'user', isMeta: true, content: [{ type: 'text', text: 'abcd' }] } }, emptyCursor()).events, [{ kind: 'injected', chars: 4 }])
})

test('matchNodes prefers file nodes whose basename or path equals the query, else matches label or path', () => {
  const g = applyEvents(emptyGraph(), [
    { kind: 'prompt', id: 'p', text: 'q' },
    { kind: 'assistant', messageId: 'm', text: 'ok' },
    { kind: 'tool_use', id: 't', messageId: 'm', name: 'Read', input: { file_path: '/src/A.ts' } },
  ])
  assert.deepEqual(matchNodes(g, 'a.TS'), ['file:/src/A.ts'])
  assert.deepEqual(matchNodes(g, '/src/a.ts'), ['file:/src/A.ts'])
  assert.deepEqual(matchNodes(g, 'src/').sort(), ['file:/src/A.ts', 'tool:t'])
  assert.deepEqual(matchNodes(g, 'zzz'), [])
  assert.deepEqual(matchNodes(g, '  '), [])
})

test('enrichTool marks an error once and never double counts tokens', () => {
  const g = applyEvents(emptyGraph(), [{ kind: 'assistant', messageId: 'm', text: 'ok' }, { kind: 'tool_use', id: 't', messageId: 'm', name: 'Bash', input: {} }])
  const before = g.nodes['tool:t']!.tokens
  const g2 = enrichTool(g, 't', { isError: true })
  assert.equal(g2.nodes['tool:t']!.meta?.isError, true)
  assert.equal(g2.nodes['tool:t']!.tokens, before)
  assert.equal(enrichTool(g, 'missing', { isError: true }), g)
})

test('turn usage sets output tokens and window occupancy on the latest turn, once', async () => {
  const { applyTurnUsage } = await import('../src/core/live.ts')
  const g = applyEvents(emptyGraph(), [{ kind: 'assistant', messageId: 'm', text: 'abcd' }])
  const usage = { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 900, output_tokens: 40 }
  const g2 = applyTurnUsage(applyTurnUsage(g, usage), usage)
  assert.equal(g2.nodes['turn:m']!.tokens, 41)
  assert.equal(g2.nodes['turn:m']!.meta?.windowTokens, 1002)
  assert.equal(applyTurnUsage(g, undefined), g)
})

// Feature 23 (core half): where the transcript lives, and the $.session.messages() fallback.
import { messagesToEvents, transcriptPath } from '../src/core/live.ts'

test('transcriptPath maps the cwd to the projects folder name the CLI uses', () => {
  assert.equal(transcriptPath('/root', '/home/user/context-management', 'abc-1'), '/root/.claude/projects/-home-user-context-management/abc-1.jsonl')
  assert.equal(transcriptPath('/home/o/', '/w/my.repo', 's'), '/home/o/.claude/projects/-w-my-repo/s.jsonl')
})

test('messagesToEvents turns { role, text, toolUses } into prompt, turn, tool and file nodes', () => {
  const msgs = [
    { role: 'user', text: 'fix a.ts', toolUses: [] },
    { role: 'assistant', text: 'Reading.', toolUses: [{ tool_use_id: 't1', tool: 'Read', input: { file_path: '/r/a.ts' }, text: 'x'.repeat(400) }] },
    { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't1', text: 'x'.repeat(400) }] },
    { role: 'user', text: 'and b?', toolUses: [] },
  ]
  const g = applyEvents(emptyGraph(), messagesToEvents(msgs))
  const kinds = Object.values(g.nodes).map((n) => n.kind).sort()
  assert.deepEqual(kinds, ['file', 'prompt', 'prompt', 'tool', 'turn'])
  assert.ok(g.nodes['tool:t1']!.tokens >= 100)
  assert.ok(g.latestPromptId)
  assert.equal(g.nodes[g.latestPromptId!]!.label.startsWith('and b?'), true)
})

test('messagesToEvents ignores junk', () => {
  assert.deepEqual(messagesToEvents(null as never), [])
  assert.deepEqual(messagesToEvents([null, 3, { role: 'x' }] as never), [])
})
