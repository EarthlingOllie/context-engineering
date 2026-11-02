// context-graph mod shell (design.md section 5). Adapter only: every decision lives in src/core.
// Hooks feed $.state atoms; the pane reads them and draws Svg (desktop/vscode/mobile), Raster (terminal)
// or a text list. Every hook calls or returns next exactly once and is guarded, so the mod cannot block
// a tool, a prompt or a row.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { applyEvents, emptyGraph } from '../src/core/ingest.ts'
import { appendToEvents, applyTurnUsage, emptyCursor, enrichTool, matchNodes } from '../src/core/live.ts'
import { blastRadius } from '../src/core/blast.ts'
import { layout } from '../src/core/layout.ts'
import { buildScene } from '../src/core/scene.ts'
import { renderSvg } from '../src/core/svg.ts'
import { rasterize, toBase64 } from '../src/core/raster.ts'
import type { Focus, Graph, GraphEvent, Seed } from '../src/core/types.ts'
import type { ContextGraphView as ViewState } from '../types/index.d.ts'

const PLUGIN = 'context-graph'
const PANE = 'context-graph'
const TITLE = 'Context graph'
const TOOL = 'context_graph'
const TOOL_ID = `mcp__${PLUGIN}__${TOOL}`

export const DEFAULT_VIEW: ViewState = { yaw: 30, pitch: 20, distance: 0, fov: 50, zoom: 1, autoOrbit: false }

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
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))

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
    if (String(e.tool) === TOOL_ID) return next(e)
    const r = await next(e)
    if (e.agentId === undefined && 'isError' in r && r.isError === true) await writeGraph($, (g) => enrichTool(g, e.tool_use_id, { isError: true }))
    return r
  }).catch(($, e, next) => next(e))

  // ------------------------------------------------------------------ pane
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const [g, positions, focus, view] = await Promise.all([read($, graphAtom), read($, posAtom), read($, focusAtom), read($, viewAtom)])
    const blast = blastRadius(g, focus.seeds)
    const s = stats(g, focus)
    const cols = Math.max(20, Math.min(512, e.props.bodyColumns ?? e.viewport?.columns ?? 80))
    const bodyRows = e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 30
    const input = { graph: g, positions, blast, view, focus }

    let drawing: unknown
    if (e.surface === 'desktop' || e.surface === 'vscode' || e.surface === 'mobile') {
      const { Svg } = $.ui.resolve(e)
      const w = cols * 8, ht = Math.round((w * 3) / 4)
      const source = renderSvg(buildScene(input, { w, h: ht }), { width: w, height: ht, theme: 'dark' })
      drawing = <Svg source={source} alt={`Context graph: ${s.line}`} width={w} height={ht} isInteractive />
    } else if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const rows = Math.max(4, Math.min(bodyRows - 4, 60))
      const cells = toBase64(rasterize(buildScene(input, { w: cols * 2, h: rows * 4 }), cols, rows))
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
    const zoom = (k: number) => () => update($, viewAtom, (v) => ({ ...v, zoom: Math.max(0.25, Math.min(4, v.zoom * k)) }))
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
          <Button key="orbit" label="⟳" onPress={() => update($, viewAtom, (v) => ({ ...v, autoOrbit: !v.autoOrbit }))} />
          <Button key="refocus" label="◎" onPress={() => update($, viewAtom, (v) => ({ ...DEFAULT_VIEW, autoOrbit: v.autoOrbit }))} />
        </Box>
        <Text key="status">{s.line}</Text>
      </Box>
    )
  })

  // ------------------------------------------------------------------ command (registered in session.start)
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PLUGIN, description: 'Context graph: open | focus <text> | clear | stats' })
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
      default:
        return { text: `Unknown subcommand "${sub}". Use open | focus <text> | clear | stats.` }
    }
  })
}
