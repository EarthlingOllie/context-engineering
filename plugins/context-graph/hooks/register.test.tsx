// Shell behaviour under `claude plugin test`: features 17-22 (pane, live hooks, command, tool, view),
// 23 (bootstrap on start) and 24 (fail-safe hooks).
import { expect, mock, test } from 'claude-code/testing'
import { buildGraph } from '../src/core/ingest.ts'
import { TOOL_SCHEMA as CORE_SCHEMA } from '../src/core/toolInput.ts'
import { TOOL_SCHEMA } from './register.tsx'

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

/** Default engine stubs; events named in `except` are left for the test to stub itself. */
const engine = (on: (...a: never[]) => unknown, except: string[] = []) => {
  const raw = on as unknown as (ev: string, h: (...a: never[]) => unknown) => void
  const o = (ev: string, h: (...a: never[]) => unknown) => (except.includes(ev) ? undefined : raw(ev, h))
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
  // v2 (v2-23): export writes the solution page (an Artifact fragment unless --document) to the export path
  expect((await run($ as never, 'export /tmp/g.html --document')).text).toBe('Exported 0 solution nodes to /tmp/g.html.')
  expect((await run($ as never, 'export')).text).toBe('Exported 0 solution nodes to /work/.context-graph/solution.html.')
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
  expect(specs[0]!.inputSchema?.properties?.action?.enum).toEqual(['inspect', 'focus', 'clear', 'add', 'link', 'resolve', 'abandon', 'import'])
  expect(TOOL_SCHEMA).toBe(CORE_SCHEMA)
  expect(specs[0]!.inputSchema).toEqual(JSON.parse(JSON.stringify(CORE_SCHEMA)))

  for (let i = 1; i <= 8; i++) await feedTurn($ as never, i, `/repo/f${i}.ts`)
  const inspected = await callTool($ as never, { action: 'inspect' })
  // v2: the transcript nodes moved under `evidence` (top 15); `nodes` is the solution model
  const body = JSON.parse(inspected.result) as { evidence: { nodes: { id: string; kind: string; tokens: number; hop: number | null; weight: number }[] } }
  expect(body.evidence.nodes.length).toBeGreaterThan(0)
  expect(body.evidence.nodes.length).toBeLessThanOrEqual(15)
  for (const n of body.evidence.nodes) for (const k of ['id', 'kind', 'tokens', 'hop', 'weight']) expect(k in n).toBe(true)

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
  // v2 (v2-21) also looks for <cwd>/.context-graph/solution.json; the transcript is read once
  expect(reads.filter((r) => r.endsWith('.jsonl'))).toEqual(['/home/me/.claude/projects/-repo/S1.jsonl'])
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
  expect(reads.filter((r) => r.endsWith('.jsonl')).length).toBe(0)
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

// ------------------------------------------------------------------ v2: solution model (features v2-16..v2-18)

test('v2-16: positions stored in the old pos-1 shape are declined and the pane still renders', async ($, on) => {
  engine(on)
  let seeded = 0
  ;(on as On)('state.get', (_: unknown, e: { key?: string }, next: (e: never) => unknown) => {
    if (e.key !== 'positions') return next(e as never)
    seeded++
    return { value: { value: { 'prompt:u1': { x: 1, y: 2, z: 3 } }, shape: 'pos-1' } }
  })
  await feedTurn($ as never, 1)
  expect(seeded).toBeGreaterThan(0)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })).toBeDefined()
    expect(await statusText(ui)).toMatch(/^4 nodes/)
    await ui.unmount()
  }
})

type Reply = { ok: boolean; id?: string; error?: string; warnings?: string[]; model: { nodes: number; open: string[]; abandoned: string[] }; export: { path: string; lastWrittenAt: number | null } }
const author = async ($: unknown, input: object) => JSON.parse((await callTool($ as never, input)).result) as Reply
const modelText = async ($: unknown) => (await run($ as never, 'model')).text ?? ''

test('v2-17: the tool adds, links, resolves and abandons; a bad link changes nothing; inspect reports the model', async ($, on) => {
  engine(on)
  bootEnv(on, () => ({ value: FIXTURE }))
  await $.session.start(START)
  const ev = Object.keys(buildGraph(FIXTURE).nodes).find((id) => id.startsWith('turn:'))!

  const g = await author($, { action: 'add', kind: 'goal', label: 'Visualise the context', evidence: [ev] })
  expect(g.ok).toBe(true)
  expect(g.id).toBe('goal:visualise-the-context')
  expect((await author($, { action: 'add', kind: 'component', label: 'Pane' })).id).toBe('component:pane')
  expect((await author($, { action: 'link', from: 'goal:visualise-the-context', to: 'component:pane', kind: 'depends-on' })).ok).toBe(true)
  const q = await author($, { action: 'add', kind: 'question', label: 'Does it render?' })
  expect(q.model.open).toEqual(['question:does-it-render'])
  expect((await author($, { action: 'add', kind: 'decision', label: 'Use SVG' })).ok).toBe(true)
  const r = await author($, { action: 'resolve', id: 'question:does-it-render', by: 'decision:use-svg', note: 'yes' })
  expect(r.ok).toBe(true)
  expect(r.model.open).toEqual([])
  expect((await author($, { action: 'add', kind: 'decision', label: 'Use WebGL' })).ok).toBe(true)
  const a = await author($, { action: 'abandon', id: 'decision:use-webgl', reason: 'no GPU in the pane' })
  expect(a.ok).toBe(true)
  expect(a.model.abandoned).toEqual(['decision:use-webgl'])
  expect(a.model.nodes).toBe(5)
  expect(a.export.path).toBe('/repo/.context-graph/solution.html')

  const before = await modelText($)
  const bad = await author($, { action: 'link', from: 'component:pane', to: 'decision:use-svg', kind: 'constrains' })
  expect(bad.ok).toBe(false)
  expect(bad.error).toBe('bad-link')
  expect(await modelText($)).toBe(before)
  const invalid = await author($, { action: 'add', kind: 'constrains', label: 'x' })
  expect(invalid.ok).toBe(false)
  expect(invalid.error).toMatch(/^kind/)

  const ins = JSON.parse((await callTool($ as never, { action: 'inspect' })).result) as {
    goal: { id: string; label: string } | null
    nodes: { id: string; kind: string; status: string; label: string; health: string; relevance: number }[]
    open: string[]
    unjustified: string[]
    touched: string[]
    bearing: string[]
    health: Record<string, number>
    export: { path: string; lastWrittenAt: number | null }
  }
  expect(ins.goal?.id).toBe('goal:visualise-the-context')
  expect(ins.nodes.length).toBe(5)
  for (let i = 1; i < ins.nodes.length; i++) expect(ins.nodes[i - 1]!.relevance).toBeGreaterThanOrEqual(ins.nodes[i]!.relevance)
  expect(ins.nodes.find((n) => n.id === 'goal:visualise-the-context')!.health).toBe('in-window')
  expect(ins.nodes.find((n) => n.id === 'component:pane')!.health).toBe('never-loaded')
  expect(ins.open).toEqual([])
  expect(ins.unjustified).toEqual(['decision:use-svg'])
  expect(ins.health).toEqual({ 'in-window': 1, compacted: 0, 'never-loaded': 3 })
  expect(ins.export).toEqual({ path: '/repo/.context-graph/solution.html', lastWrittenAt: null })

  const f = await callTool($ as never, { action: 'focus', nodeIds: ['component:pane'], note: 'pane' })
  expect(f.result).toContain('Focused on 1 nodes')
  const ins2 = JSON.parse((await callTool($ as never, { action: 'inspect' })).result) as { reason: string; touched: string[]; bearing: string[] }
  expect(ins2.reason).toBe('model')
  expect(ins2.touched).toEqual(['component:pane'])
  expect(ins2.bearing).toEqual(['goal:visualise-the-context'])

  const unknown = await callTool($ as never, { action: 'delete' })
  expect(unknown.result).toContain('inspect | focus | clear | add | link | resolve | abandon | import')
  for (const junk of [{}, { action: 'add', kind: 'goal' }, { action: 'import', ops: 'x' }, { action: 'link', from: 1 }, { action: 'focus', nodeIds: 'x' }]) {
    const res = await callTool($ as never, junk)
    expect(typeof res.result).toBe('string')
  }
})

type ImportReply = { ok: boolean; error?: string; applied: number; failed: { i: number; error?: string }[]; dangling: string[]; model: { nodes: number } }
const SEED = (ops: object[]) => JSON.stringify({ format: 'context-graph/solution@1', ops })

test('v2-18: import merges inline ops, replaces on mode replace, reads a seed path, and reports read errors', async ($, on) => {
  engine(on)
  const files: Record<string, string> = {
    '/repo/seed.json': SEED([
      { op: 'add', kind: 'goal', label: 'G' },
      { op: 'add', kind: 'risk', label: 'R', evidence: ['turn:nope'] },
      { op: 'link', from: 'risk:r', to: 'goal:zzz', kind: 'constrains' },
    ]),
  }
  bootEnv(on, (path) => {
    if (path in files) return { value: files[path] }
    if (path.endsWith('.jsonl')) return { value: FIXTURE }
    throw new Error(`ENOENT: ${path}`)
  })
  await $.session.start(START)

  const inline = JSON.parse((await callTool($ as never, { action: 'import', ops: [{ op: 'add', kind: 'component', label: 'A' }, { op: 'add', kind: 'component', label: 'B' }] })).result) as ImportReply
  expect(inline.applied).toBe(2)
  expect(inline.failed).toEqual([])
  expect(inline.model.nodes).toBe(2)

  const merged = JSON.parse((await callTool($ as never, { action: 'import', path: 'seed.json' })).result) as ImportReply
  expect(merged.applied).toBe(2)
  expect(merged.failed.length).toBe(1)
  expect(merged.failed[0]!.i).toBe(2)
  expect(merged.dangling).toEqual(['turn:nope'])
  expect(merged.model.nodes).toBe(4)

  const replaced = JSON.parse((await callTool($ as never, { action: 'import', path: '/repo/seed.json', mode: 'replace' })).result) as ImportReply
  expect(replaced.model.nodes).toBe(2)

  const missing = JSON.parse((await callTool($ as never, { action: 'import', path: 'nope.json' })).result) as ImportReply
  expect(missing.ok).toBe(false)
  expect(missing.error).toMatch(/^read: /)
  const notSeed = JSON.parse((await callTool($ as never, { action: 'import', ops: [], path: undefined })).result) as ImportReply
  expect(notSeed.applied).toBe(0)

  expect((await run($ as never, 'import seed.json --replace')).text).toBe('Imported 3 ops (1 failed, 1 dangling).')
  expect((await run($ as never, 'import nope.json')).text).toMatch(/^Import failed: read: /)
  expect(await modelText($)).toContain('G')
})

// ------------------------------------------------------------------ v2: grow-in, Artifact export, persistence, pane, commands (v2-19..v2-23)

/** fs stubs: reads from `files` (else the transcript fixture for *.jsonl, else ENOENT); writes recorded (or rejected). */
function fsEnv(on: unknown, files: Record<string, string> = {}) {
  const writes: { path: string; text: string }[] = []
  const ctl = { fail: false }
  bootEnv(on, (path) => {
    if (path in files) return { value: files[path] }
    if (path.endsWith('.jsonl')) return { value: FIXTURE }
    throw new Error(`ENOENT: ${path}`)
  })
  ;(on as On)('fs.write', (_: unknown, e: { path: string; text: string }) => {
    if (ctl.fail) throw new Error('EACCES')
    writes.push(e)
    return { value: undefined }
  })
  return { writes, ctl }
}

/** The <g class="s"> block of one solution node in an svg source. */
const solBlock = (source: string, id: string) => source.split('<g class="s"').find((b) => b.includes(`data-id="${id}"`)) ?? ''
const TURN_DONE = { answer: 'done', durationMs: 1, isAborted: false, turnId: 'x', reason: 'answer' } as never

test('v2-19: prompt.submit marks the prompt start; nodes added after it grow in, earlier ones do not; meta prompts leave it', async ($, on) => {
  engine(on)
  fsEnv(on)
  await $.session.start(START)
  await author($, { action: 'add', kind: 'goal', label: 'Old goal' })
  await $.prompt.submit({ text: 'next question', wait: false } as never)
  await author($, { action: 'add', kind: 'question', label: 'New question' })
  await $.prompt.submit({ text: 'hidden', isMeta: true, wait: false } as never)
  await author($, { action: 'add', kind: 'component', label: 'New part' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const source = await svgSource(ui)
  expect(solBlock(source, 'question:new-question')).toMatch(/<animateTransform[^>]*type="scale"/)
  expect(solBlock(source, 'component:new-part')).toMatch(/<animateTransform[^>]*type="scale"/)
  expect(solBlock(source, 'goal:old-goal')).toContain('data-kind="goal"')
  expect(solBlock(source, 'goal:old-goal')).not.toContain('<animateTransform')
  await ui.unmount()
})

test('v2-20: turn.complete writes solution.html (fragment) and solution.json once per change; export-path retargets; a failed write is recorded', async ($, on) => {
  engine(on, ['turn.complete'])
  let turns = 0
  ;(on as On)('turn.complete', () => {
    turns++
    return { text: 'done', usage: { input_tokens: 5, output_tokens: 7 } }
  })
  const { writes, ctl } = fsEnv(on)
  await $.session.start(START)
  await author($, { action: 'add', kind: 'goal', label: 'Ship the map' })
  const r1 = await $.turn.complete(TURN_DONE)
  expect(turns).toBe(1)
  expect((r1 as { text?: string }).text).toBe('done')
  expect(writes.map((w) => w.path)).toEqual(['/repo/.context-graph/solution.html', '/repo/.context-graph/solution.json'])
  expect(writes[0]!.text).not.toContain('<html')
  expect(writes[0]!.text.startsWith('<title>Context Window Graph</title>')).toBe(true)
  const seed = JSON.parse(writes[1]!.text) as { format: string; ops: { op: string; kind?: string; label?: string }[] }
  expect(seed.format).toBe('context-graph/solution@1')
  expect(seed.ops.some((o) => o.op === 'add' && o.kind === 'goal' && o.label === 'Ship the map')).toBe(true)
  const ins = JSON.parse((await callTool($ as never, { action: 'inspect' })).result) as { export: { path: string; lastWrittenAt: number | null } }
  expect(typeof ins.export.lastWrittenAt).toBe('number')

  await $.turn.complete(TURN_DONE)
  expect(writes.length).toBe(2)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /export: \/repo\/\.context-graph\/solution\.html \(written / }))).toBeDefined()
  expect((await run($ as never, 'export-path out/x.html')).text).toBe('Export path set to /repo/out/x.html.')
  await author($, { action: 'add', kind: 'component', label: 'Pane' })
  await $.turn.complete(TURN_DONE)
  expect(writes.slice(2).map((w) => w.path)).toEqual(['/repo/out/x.html', '/repo/out/solution.json'])

  ctl.fail = true
  await author($, { action: 'add', kind: 'risk', label: 'Disk full' })
  const r2 = await $.turn.complete(TURN_DONE)
  expect(turns).toBe(4)
  expect((r2 as { text?: string }).text).toBe('done')
  const ins2 = JSON.parse((await callTool($ as never, { action: 'inspect' })).result) as { export: { lastError?: string } }
  expect(String(ins2.export.lastError ?? '').length).toBeGreaterThan(0)
  expect((await ui.find({ type: 'Text', text: /export: \/repo\/out\/x\.html \(error/ }))).toBeDefined()
  await ui.unmount()
})

test('v2-21: a reload keeps the model; an empty model restores from solution.json; a missing or invalid file leaves it empty', async ($, on) => {
  engine(on, ['session.start'])
  let starts = 0
  ;(on as On)('session.start', (_: unknown, e: { cwd: string }) => {
    starts++
    return { cwd: e.cwd }
  })
  const files: Record<string, string> = {}
  fsEnv(on, files)
  await $.session.start(START)
  expect(starts).toBe(1)
  expect(await modelText($)).toBe('No solution model yet.')

  files['/repo/.context-graph/solution.json'] = 'not json'
  await $.session.start(START)
  expect(starts).toBe(2)
  expect(await modelText($)).toBe('No solution model yet.')

  files['/repo/.context-graph/solution.json'] = SEED([{ op: 'add', kind: 'goal', label: 'Restored goal' }, { op: 'add', kind: 'question', label: 'Still open?' }])
  const r = await $.session.start(START)
  expect(r).toEqual({ cwd: '/repo' })
  expect(starts).toBe(3)
  const restored = await modelText($)
  expect(restored).toContain('Goal: Restored goal (goal:restored-goal)')
  expect(restored).toContain('[ ] Still open? (question:still-open)')

  files['/repo/.context-graph/solution.json'] = SEED([{ op: 'add', kind: 'goal', label: 'Other goal' }])
  await author($, { action: 'add', kind: 'component', label: 'Live part' })
  await $.session.start(START)
  const kept = await modelText($)
  expect(kept).toContain('Restored goal')
  expect(kept).toContain('Live part')
  expect(kept).not.toContain('Other goal')
})

test('v2-22: the pane draws the layered graph on every surface; layers cycles; header and alt carry the goal and open questions', async ($, on) => {
  engine(on)
  fsEnv(on)
  await $.session.start(START)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /No solution model yet/ }))).toBeDefined()
    if (surface !== 'terminal') expect(await svgSource(ui)).toContain('class="ev')
    await ui.unmount()
  }
  await author($, { action: 'add', kind: 'goal', label: 'Map the work' })
  await author($, { action: 'add', kind: 'component', label: 'Pane' })
  await author($, { action: 'add', kind: 'question', label: 'Works on the web?' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Raster', key: 'g' })).toBeDefined()
      expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    } else {
      const svg = await ui.find({ type: 'Svg' })
      expect(String(svg!.props.source)).toContain('data-kind="goal"')
      expect(String(svg!.props.alt)).toContain('Map the work')
      expect(String(svg!.props.alt)).toContain('Works on the web?')
    }
    expect((await ui.find({ type: 'Text', text: /No solution model yet/ }))).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /^GOAL Map the work · 1 component · 0 decisions · 1 open question · health 0 in \/ 0 compacted \/ 3 missing · export: / }))).toBeDefined()
    expect(await statusText(ui)).toMatch(/nodes · blast/)
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await viewText(ui)).toBe('yaw 30° · pitch 20° · zoom 1.00×')
  await ui.press({ key: 'layers' })
  expect(await viewText(ui)).toBe('yaw 30° · pitch 20° · zoom 1.00× · layers solution')
  expect(await svgSource(ui)).toContain('data-kind="goal"')
  expect(await svgSource(ui)).not.toContain('class="ev')
  await ui.press({ key: 'layers' })
  expect(await viewText(ui)).toBe('yaw 30° · pitch 20° · zoom 1.00× · layers evidence')
  expect(await svgSource(ui)).not.toContain('data-kind="goal"')
  expect(await svgSource(ui)).toContain('class="ev')
  await ui.press({ key: 'layers' })
  expect(await viewText(ui)).toBe('yaw 30° · pitch 20° · zoom 1.00×')
  await ui.unmount()
})

test('v2-23: model outline marks; export writes the solution page (fragment, or --document); export-path; help lists every subcommand', async ($, on) => {
  engine(on)
  const { writes } = fsEnv(on)
  await $.session.start(START)
  await author($, { action: 'add', kind: 'goal', label: 'G' })
  await author($, { action: 'add', kind: 'question', label: 'Q open' })
  await author($, { action: 'add', kind: 'risk', label: 'R' })
  await author($, { action: 'add', kind: 'decision', label: 'D fix' })
  await author($, { action: 'add', kind: 'decision', label: 'D old' })
  await author($, { action: 'resolve', id: 'risk:r', by: 'decision:d-fix' })
  await author($, { action: 'abandon', id: 'decision:d-old', reason: 'no' })
  const outline = await modelText($)
  expect(outline).toContain('Goal: G (goal:g)')
  expect(outline).toContain('question:\n  [ ] Q open (question:q-open)')
  expect(outline).toContain('risk:\n  [x] R (risk:r)')
  expect(outline).toContain('~~D old (decision:d-old)~~')

  const n = writes.length
  expect((await run($ as never, 'export')).text).toBe('Exported 5 solution nodes to /repo/.context-graph/solution.html.')
  expect((await run($ as never, 'export /tmp/page.html --document')).text).toBe('Exported 5 solution nodes to /tmp/page.html.')
  const out = writes.slice(n)
  expect(out.map((w) => w.path)).toEqual(['/repo/.context-graph/solution.html', '/tmp/page.html'])
  expect(out[0]!.text).not.toContain('<html')
  expect(out[0]!.text).toContain('id="cg-data"')
  expect(out[1]!.text.startsWith('<!doctype html>')).toBe(true)

  expect((await run($ as never, 'export-path /abs/s.html')).text).toBe('Export path set to /abs/s.html.')
  const ins = JSON.parse((await callTool($ as never, { action: 'inspect' })).result) as { export: { path: string } }
  expect(ins.export.path).toBe('/abs/s.html')
  expect((await run($ as never, 'export-path')).text).toMatch(/^Usage: /)
  expect((await run($ as never, 'bogus')).text).toContain('open | focus | clear | stats | export | export-path | import | model | reset')
})
