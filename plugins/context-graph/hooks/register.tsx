// context-graph mod shell (design.md section 5). Adapter only: every decision lives in src/core.
// Hooks feed $.state atoms; the pane reads them and draws Svg (desktop/vscode/mobile), Raster (terminal)
// or a text list. Every hook calls or returns next exactly once and is guarded, so the mod cannot block
// a tool, a prompt or a row.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'
import { applyEvents, buildGraph, emptyGraph } from '../src/core/ingest.ts'
import { appendToEvents, applyTurnUsage, emptyCursor, enrichTool, matchNodes, messagesToEvents, transcriptPath } from '../src/core/live.ts'
import { blastRadius } from '../src/core/blast.ts'
import { layout } from '../src/core/layout.ts'
import { buildScene } from '../src/core/scene.ts'
import { renderSvg } from '../src/core/svg.ts'
import { rasterize, toBase64 } from '../src/core/raster.ts'
import { exportHtml } from '../src/core/exportHtml.ts'
import { TOOL_SCHEMA } from '../src/core/toolInput.ts'
import type { BlastRadius, Focus, Graph, GraphEvent, Seed, Vec3 } from '../src/core/types.ts'
import type { ContextGraphView as ViewState } from '../types/index.d.ts'

const PLUGIN = 'context-graph'
const PANE = 'context-graph'
const TITLE = 'Context graph'
const TOOL = 'context_graph'
const TOOL_ID = `mcp__${PLUGIN}__${TOOL}`

export const DEFAULT_VIEW: ViewState = { yaw: 30, pitch: 20, distance: 0, fov: 50, zoom: 1, autoOrbit: false }
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
export const ORBIT_MS = 100
export const ORBIT_STEP = 3
const INSPECT_LIMIT = 25

export { TOOL_SCHEMA }
const TOOL_DESCRIPTION =
  'The context graph: the conversation as nodes (system, prompts, turns, tool calls, files, compactions) sized by tokens, with the blast radius of the current question highlighted in the context-graph pane. inspect lists the reached nodes (id, kind, tokens, hop, weight); focus points the blast radius at the nodes that matter for the question; clear returns it to the latest prompt.'

const graphAtom = atom({ plugin: 'context-graph', key: 'graph' } as const, emptyGraph(), { shape: 'graph-1' })
const posAtom = atom({ plugin: 'context-graph', key: 'positions' } as const, {}, { shape: 'pos-1' })
const focusAtom = atom({ plugin: 'context-graph', key: 'focus' } as const, { seeds: [] } as Focus, { shape: 'focus-1' })
const viewAtom = atom({ plugin: 'context-graph', key: 'view' } as const, DEFAULT_VIEW, { shape: 'view-1' })
const cursorAtom = atom({ plugin: 'context-graph', key: 'cursor' } as const, emptyCursor(), { shape: 'cursor-1' })

type Dollar = EngineInterface

/** Apply a graph change and warm-start the layout for it. */
async function writeGraph($: Dollar, change: (g: Graph) => Graph): Promise<Graph> {
  const before = await read($, graphAtom)
  const g = await update($, graphAtom, change)
  if (g !== before) {
    const prev = await read($, posAtom)
    await update($, posAtom, () => layout(g, prev))
  }
  return g
}
const addEvents = ($: Dollar, evs: GraphEvent[]) => (evs.length ? writeGraph($, (g) => applyEvents(g, evs)) : read($, graphAtom))

function stats(g: Graph, focus: Focus): { line: string; blastNodes: number; blastTokens: number } {
  const seeds: Seed[] = focus.seeds
  const blast = blastRadius(g, seeds)
  const nodes = Object.keys(g.nodes).length
  const blastNodes = Object.keys(blast.weights).length
  const win = Object.values(g.nodes).filter((n) => n.inWindow).reduce((a, n) => a + n.tokens, 0)
  const mode = seeds.some((s) => s.source === 'model') ? `model${focus.note ? ` "${focus.note}"` : ''}` : 'auto'
  return { line: `${nodes} nodes · blast: ${blastNodes} nodes / ${blast.tokens} tok of ${win} window · focus: ${mode}`, blastNodes, blastTokens: blast.tokens }
}

function focusOn(g: Graph, ids: string[], note?: string): Focus {
  const f: Focus = { seeds: ids.map((id) => ({ id, source: 'model' as const })) }
  if (note) f.note = note
  return f
}

/** Module state for the orbit animation only (resets on reload; session.start restarts the timer). */
const orbit: { deg: number; timer: Timer | null; term: { cols: number; rows: number } | null } = { deg: 0, timer: null, term: null }

/** The person's /config theme as the svg palette: any `light*` theme is light; dark, auto or unreadable is dark. */
async function svgTheme($: Dollar): Promise<'light' | 'dark'> {
  try {
    const row = (await $.config.list()).find((r) => r.key === 'theme')
    return typeof row?.value === 'string' && row.value.startsWith('light') ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

async function drawInput($: Dollar) {
  const [graph, positions, focus, view] = await Promise.all([read($, graphAtom), read($, posAtom), read($, focusAtom), read($, viewAtom)])
  const blast = blastRadius(graph, focus.seeds)
  const shown = view.autoOrbit ? { ...view, yaw: (view.yaw + orbit.deg) % 360 } : view
  return { graph, positions, blast, view: shown, focus, rawView: view }
}

const terminalCells = (input: Parameters<typeof buildScene>[0], cols: number, rows: number) =>
  toBase64(rasterize(buildScene(input, { w: cols * 2, h: rows * 4 }), cols, rows))

function startOrbit($: Dollar): void {
  if (orbit.timer) return
  orbit.timer = $.clock.every(ORBIT_MS, () => {
    void (async () => {
      orbit.deg = (orbit.deg + ORBIT_STEP) % 360
      if (orbit.term) {
        const input = await drawInput($)
        await $.ui.blit({ requestId: PANE, key: 'g', cells: terminalCells(input, orbit.term.cols, orbit.term.rows) })
      }
      $.ui.invalidate('ui.render')
    })().catch(() => undefined)
  })
}

async function stopOrbit($: Dollar): Promise<void> {
  orbit.timer?.cancel()
  orbit.timer = null
  const deg = orbit.deg
  orbit.deg = 0
  await update($, viewAtom, (v) => ({ ...v, yaw: (v.yaw + deg) % 360, autoOrbit: false }))
}

function inspectReport(g: Graph, focus: Focus, blast: BlastRadius): string {
  const reached = Object.values(g.nodes)
    .map((n) => ({ id: n.id, kind: n.kind, label: n.label, tokens: n.tokens, inWindow: n.inWindow, hop: blast.hops[n.id] ?? null, weight: Math.round((blast.weights[n.id] ?? 0) * 1000) / 1000 }))
    .sort((a, b) => b.weight - a.weight || b.tokens - a.tokens || a.id.localeCompare(b.id))
    .slice(0, INSPECT_LIMIT)
  const windowTokens = Object.values(g.nodes).filter((n) => n.inWindow).reduce((a, n) => a + n.tokens, 0)
  return JSON.stringify({
    question: focus.question ?? null,
    focus: focus.seeds.some((x) => x.source === 'model') ? 'model' : 'auto',
    note: focus.note ?? null,
    seeds: blast.seeds,
    totalNodes: Object.keys(g.nodes).length,
    blastNodes: Object.keys(blast.weights).length,
    blastTokens: blast.tokens,
    windowTokens,
    nodes: reached,
  })
}

/** Resolve a focus request to known ids; unknown ids are reported, never thrown. */
function resolveFocus(g: Graph, match: string | undefined, nodeIds: string[] | undefined): { ids: string[]; unknown: string[] } {
  const ids = new Set(match ? matchNodes(g, match) : [])
  const unknown: string[] = []
  for (const id of nodeIds ?? []) (g.nodes[id] ? ids.add(id) : unknown.push(id))
  return { ids: [...ids].sort(), unknown }
}

async function serveTool($: Dollar, input: Record<string, unknown>): Promise<string> {
  const action = String(input.action ?? '')
  const g = await read($, graphAtom)
  if (action === 'inspect') {
    const focus = await read($, focusAtom)
    return inspectReport(g, focus, blastRadius(g, focus.seeds))
  }
  if (action === 'clear') {
    await update($, focusAtom, (f) => ({ seeds: [], ...(f.question ? { question: f.question } : {}) }))
    return 'Focus cleared.'
  }
  if (action === 'focus') {
    const match = typeof input.match === 'string' ? input.match : undefined
    const nodeIds = Array.isArray(input.nodeIds) ? input.nodeIds.map(String) : undefined
    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 80) : undefined
    const { ids, unknown } = resolveFocus(g, match, nodeIds)
    const tail = unknown.length ? ` Unknown ids: ${unknown.join(', ')}.` : ''
    if (!ids.length) return `No node matches.${tail}`
    const prev = await read($, focusAtom)
    const f = focusOn(g, ids, note)
    if (prev.question) f.question = prev.question
    await update($, focusAtom, () => f)
    const blast = blastRadius(g, f.seeds)
    return `Focused on ${ids.length} nodes (blast: ${Object.keys(blast.weights).length} nodes / ${blast.tokens} tok).${tail}`
  }
  return `Unknown action "${action}". Use inspect | focus | clear.`
}

/**
 * Fill an empty graph atom from what the session already holds: the transcript JSONL, or, when that cannot be
 * read, $.session.messages(). A non-empty atom (a reload) is kept as it is. Never throws.
 */
async function bootstrap($: Dollar): Promise<void> {
  if (Object.keys((await read($, graphAtom)).nodes).length) return
  let g: Graph | null = null
  try {
    const [home, cwd, id] = await Promise.all([$.env.get('HOME'), $.session.cwd(), $.session.id()])
    const text = await $.fs.read(transcriptPath(home || '/root', cwd, id))
    if (typeof text === 'string') g = buildGraph(text)
  } catch {
    g = null
  }
  if (!g || !Object.keys(g.nodes).length) {
    const msgs = await $.session.messages().catch(() => [])
    g = applyEvents(emptyGraph(), messagesToEvents(Array.isArray(msgs) ? msgs : []))
  }
  if (Object.keys(g.nodes).length) await writeGraph($, (cur) => (Object.keys(cur.nodes).length ? cur : g!))
}

const resolvePath = (cwd: string, p: string) => (p.startsWith('/') ? p : `${cwd.replace(/\/$/, '')}/${p}`)

export const register: Register = (on) => {
  // ------------------------------------------------------------------ live graph
  on('session.append', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      const cursor = await read($, cursorAtom)
      const { events, cursor: c } = appendToEvents(e, cursor)
      if (c.turn !== cursor.turn) await update($, cursorAtom, () => c)
      await addEvents($, events)
    }
    return r
  }).catch(($, e, next) => next(e)) // replay-safe: after next was called, next(e) resolves to its earlier result

  on('prompt.submit', async ($, e, next) => {
    const r = await next(e)
    if (!e.isMeta && !e.command && !('drop' in r)) await update($, focusAtom, () => ({ seeds: [], question: e.text }))
    return r
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && r.usage) await writeGraph($, (g) => applyTurnUsage(g, r.usage))
    return r
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && !('skip' in r && r.skip !== undefined)) {
      await writeGraph($, (g) => applyEvents(g, [{ kind: 'compact', id: `c${g.seq}`, summaryChars: 0 }]))
    }
    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (String(e.tool) === TOOL_ID) {
      try {
        return { result: await serveTool($, e as unknown as Record<string, unknown>) }
      } catch (err) {
        return { result: `context_graph failed: ${String(err)}`, isError: true }
      }
    }
    const r = await next(e)
    if (e.agentId === undefined && 'isError' in r && r.isError === true) await writeGraph($, (g) => enrichTool(g, e.tool_use_id, { isError: true }))
    return r
  }).catch(($, e, next) => next(e))

  // ------------------------------------------------------------------ pane
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { rawView, ...input } = await drawInput($)
    const g = input.graph, blast = input.blast
    const s = stats(g, input.focus)
    const cols = Math.max(20, Math.min(512, e.props.bodyColumns ?? e.viewport?.columns ?? 80))
    const bodyRows = e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 30

    let drawing: unknown
    if (e.surface === 'desktop' || e.surface === 'vscode' || e.surface === 'mobile') {
      const { Svg } = $.ui.resolve(e)
      const w = cols * 8, ht = Math.round((w * 3) / 4)
      const source = renderSvg(buildScene(input, { w, h: ht }), { width: w, height: ht, theme: await svgTheme($) })
      drawing = <Svg source={source} alt={`Context graph: ${s.line}`} width={w} height={ht} isInteractive />
    } else if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const rows = Math.max(4, Math.min(bodyRows - 4, 60))
      orbit.term = { cols, rows }
      const cells = terminalCells(input, cols, rows)
      drawing = <Raster key="g" columns={cols} rows={rows} cells={cells} />
    } else {
      const top = Object.entries(blast.weights).sort((a, b) => b[1] - a[1]).slice(0, 10)
      drawing = (
        <Box flexDirection="column">
          {top.map(([id, w]) => <Text>{`${w.toFixed(2)} ${g.nodes[id]?.kind ?? ''} ${g.nodes[id]?.label ?? id}`}</Text>)}
        </Box>
      )
    }
    const turn = (dyaw: number, dpitch: number) => () => update($, viewAtom, (v) => ({ ...v, yaw: (v.yaw + dyaw + 360) % 360, pitch: Math.max(-85, Math.min(85, v.pitch + dpitch)) }))
    const zoom = (k: number) => () => update($, viewAtom, (v) => ({ ...v, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(v.zoom * k * 1000) / 1000)) }))
    const toggleOrbit = async () => {
      if (rawView.autoOrbit || orbit.timer) return stopOrbit($)
      await update($, viewAtom, (v) => ({ ...v, autoOrbit: true }))
      startOrbit($)
    }
    const refocus = async () => {
      orbit.deg = 0
      await update($, viewAtom, (v) => ({ ...DEFAULT_VIEW, autoOrbit: v.autoOrbit }))
    }
    const viewLine = `yaw ${Math.round(input.view.yaw)}° · pitch ${Math.round(rawView.pitch)}° · zoom ${rawView.zoom.toFixed(2)}×${rawView.autoOrbit ? ' · orbiting' : ''}`
    return (
      <Box flexDirection="column">
        {drawing as never}
        <Box flexDirection="row">
          <Button key="yaw-" label="◀" onPress={turn(-15, 0)} />
          <Button key="yaw+" label="▶" onPress={turn(15, 0)} />
          <Button key="pitch+" label="▲" onPress={turn(0, 15)} />
          <Button key="pitch-" label="▼" onPress={turn(0, -15)} />
          <Button key="zoom+" label="+" onPress={zoom(1.25)} />
          <Button key="zoom-" label="−" onPress={zoom(0.8)} />
          <Button key="orbit" label="⟳" onPress={toggleOrbit} />
          <Button key="refocus" label="◎" onPress={refocus} />
        </Box>
        <Text key="view">{viewLine}</Text>
        <Text key="status">{s.line}</Text>
      </Box>
    )
  })

  // ------------------------------------------------------------------ command (registered in session.start)
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PLUGIN, description: 'Context graph: open | focus <text> | clear | stats | export [path] | reset' })
    await $.tool.register({ name: TOOL, description: TOOL_DESCRIPTION, inputSchema: TOOL_SCHEMA as unknown as Record<string, unknown>, isDeferred: false }).catch(() => undefined)
    if ((await read($, viewAtom)).autoOrbit) startOrbit($)
    await bootstrap($).catch(() => undefined)
    // Open the pane on load (and on every hot-reload) so it appears without a command.
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: PLUGIN }, async ($, e) => {
    const [sub = 'open', ...rest] = e.args.trim().split(/\s+/).filter(Boolean)
    const arg = rest.join(' ')
    const g = await read($, graphAtom)
    switch (sub) {
      case 'open':
        await $.ui.open({ id: PANE, title: TITLE })
        return { text: 'Opened.' }
      case 'focus': {
        const ids = matchNodes(g, arg)
        if (!ids.length) return { text: 'No node matches.' }
        await update($, focusAtom, () => focusOn(g, ids))
        return { text: `Focused on ${ids.length} nodes.` }
      }
      case 'clear':
        await update($, focusAtom, (f) => ({ seeds: [], ...(f.question ? { question: f.question } : {}) }))
        return { text: 'Focus cleared.' }
      case 'stats': {
        const counts: Record<string, number> = {}
        for (const n of Object.values(g.nodes)) counts[n.kind] = (counts[n.kind] ?? 0) + 1
        const f = await read($, focusAtom)
        return { text: `${Object.entries(counts).map(([k, n]) => `${k}: ${n}`).join(', ') || 'empty graph'}\n${stats(g, f).line}` }
      }
      case 'export': {
        const [positions, f] = await Promise.all([read($, posAtom), read($, focusAtom)])
        const path = resolvePath(await $.session.cwd(), arg || 'context-graph.html')
        const html = exportHtml(g, positions as Record<string, Vec3>, blastRadius(g, f.seeds), { title: 'Context graph', ...(f.note ? { note: f.note } : {}) })
        await $.fs.write(path, html)
        return { text: `Exported ${Object.keys(g.nodes).length} nodes to ${path}.` }
      }
      case 'reset':
        await update($, graphAtom, () => emptyGraph())
        await update($, posAtom, () => ({}))
        await update($, cursorAtom, () => emptyCursor())
        await update($, focusAtom, () => ({ seeds: [] }))
        return { text: 'Graph reset.' }
      default:
        return { text: `Unknown subcommand "${sub}". Use open | focus <text> | clear | stats | export [path] | reset.` }
    }
  })
}
