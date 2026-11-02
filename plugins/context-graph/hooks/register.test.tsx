// Shell behaviour under `claude plugin test`: features 17-22 (pane, live hooks, command, tool, view),
// 23 (bootstrap on start) and 24 (fail-safe hooks).
import { expect, mock, test } from 'claude-code/testing'
import { buildGraph } from '../src/core/ingest.ts'

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

const themeRow = (value: string) => ({ key: 'theme', label: 'Theme', kind: 'choice', value, provider: { kind: 'engine' }, isLocked: false })

test('the desktop pane draws on a light background when the theme is light, a dark one when dark or unknown', async ($, on) => {
  engine(on)
  let theme: string | null = 'light'
  ;(on as unknown as (ev: string, h: () => unknown) => void)('config.list', () => ({ value: theme === null ? [] : [themeRow(theme)] }))
  await feedTurn($ as never, 1)
  const bg = async () => {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))!.props.source)
    await ui.unmount()
    return /<rect width="100%" height="100%" fill="(#[0-9a-f]{6})"/.exec(source)?.[1]
  }
  expect(await bg()).toBe('#ffffff')
  theme = 'light-daltonized'
  expect(await bg()).toBe('#ffffff')
  theme = 'dark'
  expect(await bg()).toBe('#0d1117')
  theme = null
  expect(await bg()).toBe('#0d1117')
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

// The test env has no fs, so the transcript fixture is inline: an attachment, two prompts, a response with a Read
// (two block rows sharing message.id) and its result, then a second response.
const env = { parentUuid: null, isSidechain: false, sessionId: 'S1', cwd: '/repo', version: '2.1.316', timestamp: '2026-11-02T10:00:00Z' }
const FIXTURE = [
  { type: 'queue-operation', operation: 'enqueue', sessionId: 'S1', content: 'hi' },
  { ...env, type: 'attachment', uuid: 'att1', attachment: { type: 'skill_listing' }, rendered: [{ content: 's'.repeat(400) }] },
  { ...env, type: 'user', uuid: 'p1', message: { role: 'user', content: 'Read a.ts and fix the failing test' } },
  { ...env, type: 'assistant', uuid: 'a1', message: { id: 'msg1', role: 'assistant', content: [{ type: 'text', text: 'Reading a.ts.' }], usage: { input_tokens: 2, cache_creation_input_tokens: 1000, cache_read_input_tokens: 3000, output_tokens: 20 } } },
  { ...env, type: 'assistant', uuid: 'a2', message: { id: 'msg1', role: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: '/repo/a.ts' } }], usage: { input_tokens: 2, cache_creation_input_tokens: 1000, cache_read_input_tokens: 3000, output_tokens: 20 } } },
  { ...env, type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'x'.repeat(1200) }] } },
  { ...env, type: 'assistant', uuid: 'a3', message: { id: 'msg2', role: 'assistant', content: [{ type: 'tool_use', id: 'tu2', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'a', new_string: 'b' } }] } },
  { ...env, type: 'user', uuid: 'r2', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu2', content: 'ok' }] } },
  { ...env, type: 'user', uuid: 'p2', message: { role: 'user', content: 'now explain it' } },
].map((r) => JSON.stringify(r)).join('\n') + '\n'

type On = (ev: string, h: (...a: never[]) => unknown) => void
const START = { cwd: '/repo', surface: 'desktop', isInteractive: true } as never

function bootEnv(on: unknown, fsRead: (path: string) => unknown) {
  const o = on as On
  const reads: string[] = []
  o('session.id', () => ({ value: 'S1' }))
  o('session.cwd', () => ({ value: '/repo' }))
  o('env.get', () => ({ value: '/home/me' }))
  o('tool.register', () => ({ value: { tool: TOOL } }))
  o('fs.read', (_: unknown, e: { path: string }) => {
    reads.push(e.path)
    return fsRead(e.path)
  })
  return reads
}

test('feature 23: session.start with an empty graph rebuilds it from the transcript JSONL', async ($, on) => {
  engine(on)
  const reads = bootEnv(on, () => ({ value: FIXTURE }))
  await $.session.start(START)
  expect(reads).toEqual(['/home/me/.claude/projects/-repo/S1.jsonl'])
  const want = Object.keys(buildGraph(FIXTURE).nodes).length
  expect(want).toBeGreaterThan(4)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(new RegExp(`^${want} nodes · blast: [1-9]`))
  await ui.unmount()
})

test('feature 23: a non-empty graph is not rebuilt on start (reload keeps the live graph)', async ($, on) => {
  engine(on)
  const reads = bootEnv(on, () => ({ value: FIXTURE }))
  await feedTurn($ as never, 1)
  await $.session.start(START)
  expect(reads.length).toBe(0)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(/^4 nodes/)
  await ui.unmount()
})

test('feature 23: when $.fs throws, start falls back to $.session.messages() and still makes prompt nodes', async ($, on) => {
  engine(on)
  bootEnv(on, () => {
    throw new Error('ENOENT')
  })
  ;(on as On)('session.messages', () => ({
    value: [
      { role: 'user', text: 'first question', toolUses: [] },
      { role: 'assistant', text: 'ok', toolUses: [{ tool_use_id: 'q1', tool: 'Read', input: { file_path: '/repo/z.ts' }, text: 'zz' }] },
      { role: 'user', text: 'second question', toolUses: [] },
    ],
  }))
  const r = await $.session.start(START)
  expect(r).toEqual({ cwd: '/repo' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(/^5 nodes/)
  expect(String((await ui.find({ type: 'Svg' }))!.props.source)).toContain('second question')
  await ui.unmount()
})

/** Engine stubs that count how often each hook's next(e) reaches the engine. */
function countingEngine(on: unknown) {
  const o = on as On
  const calls = { append: 0, prompt: 0, tool: 0 }
  o('session.append', (_: unknown, e: never, next: (e: never) => unknown) => {
    calls.append++
    return next(e)
  })
  o('prompt.submit', (_: unknown, e: { text: string }) => {
    calls.prompt++
    return { text: `engine:${e.text}` }
  })
  o('tool.call', () => {
    calls.tool++
    return { result: 'boom', isError: true }
  })
  return calls
}

const MALFORMED = [
  { uuid: 'bad1', door: 'prompt', origin, message: null },
  { uuid: 'bad2', door: 'response', origin, message: { type: 'assistant', role: 'assistant', content: null } },
  { uuid: 'bad3', door: 'prompt', origin, message: { type: 'user', role: 'user', content: [null, 7, { type: 'tool_result' }] } },
  { door: 'response' },
]

test('feature 24: malformed session.append rows call next once each and add nothing', async ($, on) => {
  const calls = countingEngine(on)
  for (const m of MALFORMED) {
    const before = calls.append
    await $.session.append(m as never)
    expect(calls.append).toBe(before + 1)
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await statusText(ui)).toMatch(/^0 nodes/)
  await ui.unmount()
})

test('feature 24: after a malformed session.append (message: null), tool.call / prompt.submit / session.append each call next once and return its result', async ($, on) => {
  const calls = countingEngine(on)
  await $.session.append(MALFORMED[0] as never)
  await $.session.append(row('u1', 'user', [{ type: 'text', text: 'q' }], 'prompt'))
  expect(calls.append).toBe(2)

  const p = await $.prompt.submit({ text: 'why?', wait: false } as never)
  expect(calls.prompt).toBe(1)
  expect(p).toEqual({ text: 'engine:why?' })

  for (const tool of ['Read', 'Bash', 'mcp__other__thing']) {
    const before = calls.tool
    const r = await $.tool.call({ tool, tool_use_id: `x-${tool}` } as never)
    expect(calls.tool).toBe(before + 1)
    expect(r).toEqual({ result: 'boom', isError: true })
    expect('deny' in (r as object)).toBe(false)
  }
})

test('feature 24: no deny is returned for a tool the plugin does not own, even with a malformed input', async ($, on) => {
  engine(on)
  for (const input of [{ tool: 'Write' }, { tool: 'Bash', tool_use_id: null }, { tool: 'mcp__context-graph__other' }]) {
    const r = await $.tool.call(input as never)
    expect('deny' in (r as object)).toBe(false)
    expect(r).toEqual({ result: { file: { content: 'abc' } } })
  }
})
