// Shell behaviour under `claude plugin test`: features 17 (pane per surface), 18 (live hooks), 19 (prompt.submit).
import { expect, mock, test } from 'claude-code/testing'

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

const run = ($: { command: { run: (e: never) => Promise<{ text?: string }> } }, args: string) =>
  $.command.run({ command: 'context-graph', args } as never)

test('feature 20: /context-graph open | focus | clear | stats | export | reset', async ($, on) => {
  engine(on)
  const writes: { path: string; text: string }[] = []
  ;(on as never as (ev: string, h: (...a: never[]) => unknown) => void)('fs.write', (_: unknown, e: { path: string; text: string }) => {
    writes.push(e)
    return { value: undefined }
  })
  ;(on as never as (ev: string, h: (...a: never[]) => unknown) => void)('session.cwd', () => ({ value: '/work' }))
  await feedTurn($ as never, 1)
  expect((await run($ as never, '')).text).toBe('Opened.')
  expect((await run($ as never, 'open')).text).toBe('Opened.')
  expect((await run($ as never, 'focus a.ts')).text).toBe('Focused on 1 nodes.')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(/focus: model$/)
  expect((await run($ as never, 'focus zzz')).text).toBe('No node matches.')
  expect((await run($ as never, 'clear')).text).toBe('Focus cleared.')
  expect(await statusText(ui)).toMatch(/focus: auto$/)
  const st = (await run($ as never, 'stats')).text ?? ''
  expect(st).toContain('prompt: 1')
  expect(st).toContain('file: 1')
  expect((await run($ as never, 'export /tmp/g.html')).text).toBe('Exported 4 nodes to /tmp/g.html.')
  expect((await run($ as never, 'export')).text).toBe('Exported 4 nodes to /work/context-graph.html.')
  expect(writes.length).toBe(2)
  expect(writes[0]!.path).toBe('/tmp/g.html')
  expect(writes[0]!.text.startsWith('<!doctype html>')).toBe(true)
  expect((await run($ as never, 'reset')).text).toBe('Graph reset.')
  expect(await statusText(ui)).toMatch(/^0 nodes/)
  expect((await run($ as never, 'bogus')).text).toMatch(/^Unknown subcommand "bogus"/)
  await ui.unmount()
})

const TOOL = 'mcp__context-graph__context_graph'
const callTool = ($: { tool: { call: (e: never) => Promise<unknown> } }, input: object) =>
  $.tool.call({ tool: TOOL, ...input } as never) as Promise<{ result: string }>

test('feature 21: session.start registers context_graph; inspect, focus and clear serve the model', async ($, on) => {
  engine(on)
  const specs: { name: string; isDeferred?: boolean; inputSchema?: { properties?: { action?: { enum?: string[] } } } }[] = []
  ;(on as never as (ev: string, h: (...a: never[]) => unknown) => void)('tool.register', (_: unknown, e: never) => {
    specs.push(e)
    return { value: { tool: TOOL } }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)
  expect(specs.length).toBe(1)
  expect(specs[0]!.name).toBe('context_graph')
  expect(specs[0]!.isDeferred).toBe(false)
  expect(specs[0]!.inputSchema?.properties?.action?.enum).toEqual(['inspect', 'focus', 'clear'])

  for (let i = 1; i <= 8; i++) await feedTurn($ as never, i, `/repo/f${i}.ts`)
  const inspected = await callTool($ as never, { action: 'inspect' })
  const body = JSON.parse(inspected.result) as { nodes: { id: string; kind: string; tokens: number; hop: number | null; weight: number }[] }
  expect(body.nodes.length).toBeGreaterThan(0)
  expect(body.nodes.length).toBeLessThanOrEqual(25)
  for (const n of body.nodes) for (const k of ['id', 'kind', 'tokens', 'hop', 'weight']) expect(k in n).toBe(true)

  const focused = await callTool($ as never, { action: 'focus', match: 'f3.ts', nodeIds: ['nope:1'], note: 'n' })
  expect(focused.result).toContain('Focused on 1 nodes')
  expect(focused.result).toContain('nope:1')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(/focus: model "n"$/)
  const cleared = await callTool($ as never, { action: 'clear' })
  expect(cleared.result).toBe('Focus cleared.')
  expect(await statusText(ui)).toMatch(/focus: auto$/)
  const bad = await callTool($ as never, { action: 'focus', nodeIds: ['nope:2'] })
  expect(bad.result).toContain('No node matches')
  expect(bad.result).toContain('nope:2')
  await ui.unmount()
})

const viewText = async (ui: { find: (q: { type?: string; text?: RegExp }) => Promise<{ text?: string } | undefined> }) =>
  (await ui.find({ type: 'Text', text: /^yaw / }))?.text ?? ''
const svgSource = async (ui: { find: (q: { type?: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) => String((await ui.find({ type: 'Svg' }))?.props.source)

test('feature 22: view buttons turn, tilt and zoom within bounds; refocus resets to auto-fit', async ($, on) => {
  engine(on)
  await feedTurn($ as never, 1)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await viewText(ui)).toBe('yaw 30° · pitch 20° · zoom 1.00×')
  const before = await svgSource(ui)
  await ui.press({ key: 'yaw+' })
  expect(await viewText(ui)).toBe('yaw 45° · pitch 20° · zoom 1.00×')
  expect(await svgSource(ui)).not.toBe(before)
  await ui.press({ key: 'yaw-' })
  await ui.press({ key: 'yaw-' })
  await ui.press({ key: 'pitch-' })
  expect(await viewText(ui)).toBe('yaw 15° · pitch 5° · zoom 1.00×')
  for (let i = 0; i < 12; i++) await ui.press({ key: 'zoom+' })
  expect(await viewText(ui)).toMatch(/zoom 4\.00×$/)
  for (let i = 0; i < 20; i++) await ui.press({ key: 'zoom-' })
  expect(await viewText(ui)).toMatch(/zoom 0\.25×$/)
  await ui.press({ key: 'refocus' })
  expect(await viewText(ui)).toBe('yaw 30° · pitch 20° · zoom 1.00×')
  expect(await svgSource(ui)).toBe(before)
  await ui.unmount()
})

test('feature 22: auto-orbit blits the terminal Raster on each clock tick and stops when toggled off', async ($, on) => {
  engine(on)
  const clock = mock.clock(on as never)
  const blits: { requestId: string; key: string; cells?: string }[] = []
  ;(on as never as (ev: string, h: (...a: never[]) => unknown) => void)('ui.blit', (_: unknown, e: never) => {
    blits.push(e)
    return { value: {} }
  })
  await feedTurn($ as never, 1)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'orbit' })
  await clock.advance(1000)
  expect(blits.length).toBeGreaterThan(0)
  expect(blits[0]!.requestId).toBe('context-graph')
  expect(blits[0]!.key).toBe('g')
  expect(typeof blits[0]!.cells).toBe('string')
  const frames = new Set(blits.map((b) => b.cells))
  expect(frames.size).toBeGreaterThan(1)
  await ui.press({ key: 'orbit' })
  const n = blits.length
  await clock.advance(1000)
  expect(blits.length).toBe(n)
  await ui.unmount()
})
