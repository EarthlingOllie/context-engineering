// Shell behaviour under `claude plugin test`: features 17 (pane per surface), 18 (live hooks), 19 (prompt.submit).
import { expect, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

const PANE = {
  plugin: 'context-graph',
  component: 'Pane',
  requestId: 'context-graph',
  props: { title: 'Context graph', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const origin = { kind: 'composer' } as const
const row = (uuid: string, type: 'user' | 'assistant', content: unknown[], door: string) =>
  ({ uuid, door, origin, message: { type, role: type, content } }) as never

/** A prompt, an assistant text + Read tool_use (two block rows), and the tool result. */
async function feedTurn($: { session: { append: (e: never) => Promise<unknown> } }, n: number, path = '/repo/a.ts') {
  await $.session.append(row(`u${n}`, 'user', [{ type: 'text', text: `question ${n} about ${path}` }], 'prompt'))
  await $.session.append(row(`a${n}`, 'assistant', [{ type: 'text', text: 'Reading.' }], 'response'))
  await $.session.append(row(`b${n}`, 'assistant', [{ type: 'tool_use', id: `t${n}`, name: 'Read', input: { file_path: path } }], 'response'))
  await $.session.append(row(`r${n}`, 'user', [{ type: 'tool_result', tool_use_id: `t${n}`, content: 'x'.repeat(800) }], 'tool-result'))
}

const statusText = async (ui: { find: (q: { key?: string; type?: string; text?: RegExp }) => Promise<{ text?: string } | undefined> }) =>
  (await ui.find({ type: 'Text', text: /nodes · blast/ }))?.text ?? ''

const engine = (on: (...a: never[]) => unknown) => {
  const o = on as unknown as (ev: string, h: (...a: never[]) => unknown) => void
  o('command.register', () => ({ value: { command: 'context-graph' } }))
  o('ui.open', () => ({ value: { isPlaced: true } }))
  o('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  o('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  o('turn.complete', () => ({ text: 'done', usage: { input_tokens: 5, cache_creation_input_tokens: 1000, cache_read_input_tokens: 4000, output_tokens: 77, model: 'm' } }))
  o('session.compact', () => ({ messages: [{ role: 'user', text: 'summary of earlier work', toolUses: [] }] }))
  o('tool.call', () => ({ result: { file: { content: 'abc' } } }))
}

test('feature 17: the pane draws Svg on desktop/vscode/mobile and a Raster on the terminal, with the status line', async ($, on) => {
  engine(on)
  await feedTurn($ as never, 1)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      const r = await ui.find({ type: 'Raster', key: 'g' })
      expect(r).toBeDefined()
      expect(Number(r!.props.columns)).toBeLessThanOrEqual(60)
      expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    } else {
      const svg = await ui.find({ type: 'Svg' })
      expect(svg).toBeDefined()
      expect(String(svg!.props.alt).length).toBeGreaterThan(0)
      expect(String(svg!.props.source).startsWith('<svg')).toBe(true)
    }
    expect(await statusText(ui)).toMatch(/^4 nodes · blast/)
    await ui.unmount()
  }
})

test('feature 18: session.append grows prompt+turn+tool+file; subagent rows add nothing', async ($, on) => {
  engine(on)
  await feedTurn($ as never, 1)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(/^4 nodes/)
  await $.session.append({ ...(row('s1', 'user', [{ type: 'text', text: 'sub' }], 'prompt') as object), agentId: 'ag1' } as never)
  expect(await statusText(ui)).toMatch(/^4 nodes/)
  await feedTurn($ as never, 2, '/repo/a.ts')
  expect(await statusText(ui)).toMatch(/^7 nodes/) // prompt, turn, tool new; the file node is shared
  await ui.unmount()
})

test('feature 18: tool.call returns the inner result unchanged; turn.complete and session.compact update the graph', async ($, on) => {
  engine(on)
  await feedTurn($ as never, 1)
  const r = await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' } as never)
  expect(r).toEqual({ result: { file: { content: 'abc' } } })
  const t = await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 'x', reason: 'answer' } as never)
  expect((t as { usage?: { output_tokens: number } }).usage?.output_tokens).toBe(77)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // 'Reading.' is 2 tokens of text; the turn's usage adds its 77 output tokens
  expect(String((await ui.find({ type: 'Svg' }))!.props.source)).toContain('turn · Reading. · 79 tok')
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'old', toolUses: [] }] } as never)
  // after compaction only the compaction node is in the window; the old prompt's radius is capped at 0.1
  expect(await statusText(ui)).toMatch(/^5 nodes/)
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg!.props.source)).toContain('compaction · Compaction summary')
  await ui.unmount()
})

test('feature 19: prompt.submit resets a model focus to the new question; meta prompts leave it', async ($, on) => {
  engine(on)
  await feedTurn($ as never, 1)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)
  const focused = await $.command.run({ command: 'context-graph', args: 'focus a.ts' } as never)
  expect(focused.text).toMatch(/^Focused on \d+ nodes\.$/)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(/focus: model/)
  await $.prompt.submit({ text: 'hidden', isMeta: true, wait: false } as never)
  expect(await statusText(ui)).toMatch(/focus: model/)
  const r = await $.prompt.submit({ text: 'why?', wait: false } as never)
  expect(r).toEqual({ text: 'why?' })
  expect(await statusText(ui)).toMatch(/focus: auto$/)
  await ui.unmount()
})
