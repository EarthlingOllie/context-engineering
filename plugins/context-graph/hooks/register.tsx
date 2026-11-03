// context-graph mod shell (design.md section 5). Adapter only: every decision lives in src/core.
// Hooks feed $.state atoms; the pane reads them and draws Svg (desktop/vscode/mobile), Raster (terminal)
// or a text list. Every hook calls or returns next exactly once and is guarded, so the mod cannot block
// a tool, a prompt or a row.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'
import { applyEvents, buildGraph, emptyGraph } from '../src/core/ingest.ts'
import { appendToEvents, applyTurnUsage, emptyCursor, enrichTool, matchNodes, messagesToEvents, transcriptPath } from '../src/core/live.ts'
import { blastRadius } from '../src/core/blast.ts'
import { layoutLayers } from '../src/core/layers.ts'
import { applyOps, emptyModel, parseSeed, toSeed } from '../src/core/solution.ts'
import { relevance } from '../src/core/relevance.ts'
import { health } from '../src/core/health.ts'
import { buildLayeredScene, solutionSummary } from '../src/core/scene.ts'
import type { LayeredSceneInput } from '../src/core/scene.ts'
import { renderSvg, summaryLine } from '../src/core/svg.ts'
import { rasterize, toBase64 } from '../src/core/raster.ts'
import { exportSolutionHtml } from '../src/core/exportHtml.ts'
import { TOOL_ACTIONS, TOOL_SCHEMA, toolInputToOps } from '../src/core/toolInput.ts'
import type { BlastRadius, Focus, Graph, GraphEvent, OpResult, Seed, SolOp, SolutionModel } from '../src/core/types.ts'
import type { ContextGraphExportState as ExportState, ContextGraphPositions as Positions, ContextGraphView as ViewState } from '../types/index.d.ts'

const PLUGIN = 'context-graph'
const PANE = 'context-graph'
const TITLE = 'Context graph'
const TOOL = 'context_graph'
const TOOL_ID = `mcp__${PLUGIN}__${TOOL}`

export const DEFAULT_VIEW: ViewState = { yaw: 30, pitch: 20, distance: 0, fov: 50, zoom: 1, autoOrbit: false, layers: 'both' }
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
export const ORBIT_MS = 100
export const ORBIT_STEP = 3
const INSPECT_LIMIT = 15
const INSPECT_SOLUTION_LIMIT = 40
export const EXPORT_DIR = '.context-graph'
export const EMPTY_HINT = 'No solution model yet: Claude adds it with context_graph add'
export const SUBCOMMANDS = ['open', 'focus', 'clear', 'stats', 'export', 'export-path', 'import', 'model', 'reset'] as const
export const HELP = 'open | focus <text> | clear | stats | export [path] [--document] | export-path <path> | import <path> [--replace] | model | reset'
const LAYER_CYCLE = { both: 'solution', solution: 'evidence', evidence: 'both' } as const

export { TOOL_SCHEMA }
export const TOOL_DESCRIPTION =
  'A map of the solution over the transcript. Keep it current as the work moves: add the goal, components, factors (requirement, constraint, assumption, dependency, risk), decisions and open questions; link them (depends-on, constrains, decided-by, contradicts, supported-by). Cite transcript ids from inspect as evidence. Resolve questions and risks with by=<decision>; abandon dropped approaches with a reason instead of deleting them. inspect shows the model, what the current question touches and evidence ids; focus/clear steer relevance; import loads a seed file. After a turn that changes the model, republish <cwd>/.context-graph/solution.html to the same Artifact URL (the mod writes it; only Claude can publish).'

const graphAtom = atom({ plugin: 'context-graph', key: 'graph' } as const, emptyGraph(), { shape: 'graph-1' })
const EMPTY_POS: Positions = { solution: {}, evidence: {} }
const DEFAULT_EXPORT: ExportState = { path: '', document: false, lastKey: null, lastWrittenAt: null }
const posAtom = atom({ plugin: 'context-graph', key: 'positions' } as const, EMPTY_POS, { shape: 'pos-2' })
const solutionAtom = atom({ plugin: 'context-graph', key: 'solution' } as const, emptyModel() as SolutionModel, { shape: 'solution-1' })
const exportAtom = atom({ plugin: 'context-graph', key: 'exportState' } as const, DEFAULT_EXPORT, { shape: 'export-1' })
const focusAtom = atom({ plugin: 'context-graph', key: 'focus' } as const, { seeds: [] } as Focus, { shape: 'focus-1' })
const viewAtom = atom({ plugin: 'context-graph', key: 'view' } as const, DEFAULT_VIEW, { shape: 'view-2' })
const cursorAtom = atom({ plugin: 'context-graph', key: 'cursor' } as const, emptyCursor(), { shape: 'cursor-1' })

type Dollar = EngineInterface

/** Warm-start both layers of the layout from the stored positions (an old or empty value lays out cold). */
async function relayout($: Dollar): Promise<void> {
  const [g, m] = await Promise.all([read($, graphAtom), read($, solutionAtom)])
  await update($, posAtom, (prev) => layoutLayers(m, g, prev?.solution && prev?.evidence ? prev : EMPTY_POS))
}

/** Apply a graph change and warm-start the layout for it. */
async function writeGraph($: Dollar, change: (g: Graph) => Graph): Promise<Graph> {
  const before = await read($, graphAtom)
  const g = await update($, graphAtom, change)
  if (g !== before) await relayout($)
  return g
}

/** Apply ops to the solution model (evidence = transcript graph ids); relayout when anything applied. */
async function writeModel($: Dollar, ops: SolOp[], replace = false, title?: string): Promise<{ model: SolutionModel; results: OpResult[] }> {
  const g = await read($, graphAtom)
  const base = replace ? emptyModel() : await read($, solutionAtom)
  const out = applyOps(base, ops, { isEvidence: (id) => id in g.nodes })
  const model = title && out.model.title !== title ? { ...out.model, title } : out.model
  if (replace || model !== base) {
    await update($, solutionAtom, () => model)
    await relayout($)
  }
  return { model, results: out.results }
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

/** Everything one frame needs: the layered scene input plus the raw view and the blast (for the text fallback). */
async function drawInput($: Dollar) {
  const [graph, model, positions, focus, view] = await Promise.all([read($, graphAtom), read($, solutionAtom), read($, posAtom), read($, focusAtom), read($, viewAtom)])
  const blast = blastRadius(graph, focus.seeds)
  const rel = relevance(model, graph, focus, blast)
  const hl = health(model, graph)
  const shown = view.autoOrbit ? { ...view, yaw: (view.yaw + orbit.deg) % 360 } : view
  const empty = !Object.keys(model.nodes).length
  const note = focus.note ?? (empty ? EMPTY_HINT : undefined)
  const scene: LayeredSceneInput = {
    model, graph, relevance: rel, health: hl, view: shown, layers: view.layers ?? 'both',
    positions: { solution: positions?.solution ?? {}, evidence: positions?.evidence ?? {} },
    ...(note ? { note } : {}),
  }
  return { scene, rawView: view, focus, blast, empty }
}

const terminalCells = (input: LayeredSceneInput, cols: number, rows: number) =>
  toBase64(rasterize(buildLayeredScene(input, { w: cols * 2, h: rows * 4 }), cols, rows))

function startOrbit($: Dollar): void {
  if (orbit.timer) return
  orbit.timer = $.clock.every(ORBIT_MS, () => {
    void (async () => {
      orbit.deg = (orbit.deg + ORBIT_STEP) % 360
      if (orbit.term) {
        const { scene } = await drawInput($)
        await $.ui.blit({ requestId: PANE, key: 'g', cells: terminalCells(scene, orbit.term.cols, orbit.term.rows) })
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

function evidenceReport(g: Graph, focus: Focus, blast: BlastRadius) {
  const reached = Object.values(g.nodes)
    .map((n) => ({ id: n.id, kind: n.kind, label: n.label, tokens: n.tokens, inWindow: n.inWindow, hop: blast.hops[n.id] ?? null, weight: Math.round((blast.weights[n.id] ?? 0) * 1000) / 1000 }))
    .sort((a, b) => b.weight - a.weight || b.tokens - a.tokens || a.id.localeCompare(b.id))
    .slice(0, INSPECT_LIMIT)
  const windowTokens = Object.values(g.nodes).filter((n) => n.inWindow).reduce((a, n) => a + n.tokens, 0)
  return {
    question: focus.question ?? null,
    focus: focus.seeds.some((x) => x.source === 'model') ? 'model' : 'auto',
    note: focus.note ?? null,
    seeds: blast.seeds,
    totalNodes: Object.keys(g.nodes).length,
    blastNodes: Object.keys(blast.weights).length,
    blastTokens: blast.tokens,
    windowTokens,
    nodes: reached,
  }
}

/** Default export target: <cwd>/.context-graph/solution.html */
async function exportPath($: Dollar, st?: ExportState): Promise<string> {
  const s = st ?? (await read($, exportAtom))
  const cwd = await $.session.cwd().catch(() => '')
  return resolvePath(cwd || '.', s.path || `${EXPORT_DIR}/solution.html`)
}

async function exportInfo($: Dollar) {
  const st = await read($, exportAtom)
  return { path: await exportPath($, st), lastWrittenAt: st.lastWrittenAt, ...(st.lastError ? { lastError: st.lastError } : {}) }
}

const focusHash = (f: Focus) => `${f.seeds.map((x) => x.id).sort().join(',')}|${f.note ?? ''}`
const hhmmss = (ms: number) => new Date(ms).toISOString().slice(11, 19)
const besideJson = (htmlPath: string) => `${htmlPath.slice(0, htmlPath.lastIndexOf('/') + 1)}solution.json`

/** The solution page for the current state (Artifact fragment unless `document`). */
async function solutionPage($: Dollar, document: boolean): Promise<{ html: string; model: SolutionModel }> {
  const [g, m, positions, focus] = await Promise.all([read($, graphAtom), read($, solutionAtom), read($, posAtom), read($, focusAtom)])
  const blast = blastRadius(g, focus.seeds)
  const input = { model: m, graph: g, positions: { solution: positions?.solution ?? {}, evidence: positions?.evidence ?? {} }, relevance: relevance(m, g, focus, blast), health: health(m, g), blast }
  return { html: exportSolutionHtml(input, { document, since: m.promptSeq, ...(focus.note ? { note: focus.note } : {}) }), model: m }
}

/**
 * turn.complete step (design 5.3): when the model, the focus or the compaction count changed since the last write,
 * write the Artifact page to the export path and solution.json beside it. Never throws; a failed write is recorded.
 */
async function autoExport($: Dollar): Promise<void> {
  const [m, g, focus, st] = await Promise.all([read($, solutionAtom), read($, graphAtom), read($, focusAtom), read($, exportAtom)])
  if (!Object.keys(m.nodes).length) return
  const compactions = Object.values(g.nodes).filter((n) => n.kind === 'compaction').length
  const key = `${m.seq}:${compactions}:${focusHash(focus)}`
  if (key === st.lastKey) return
  const path = await exportPath($, st)
  try {
    const { html, model } = await solutionPage($, st.document)
    await $.fs.write(path, html)
    await $.fs.write(besideJson(path), toSeed(model))
    const at = await $.clock.now().catch(() => Date.now())
    await update($, exportAtom, (cur) => {
      const { lastError: _drop, ...rest } = cur
      return { ...rest, lastKey: key, lastWrittenAt: at }
    })
  } catch (err) {
    await update($, exportAtom, (cur) => ({ ...cur, lastKey: null, lastError: err instanceof Error ? err.message : String(err) }))
  }
}

/** Restore an empty model from <cwd>/.context-graph/solution.json (design 5.2). Missing or invalid: stays empty. */
async function restoreModel($: Dollar): Promise<void> {
  if (Object.keys((await read($, solutionAtom)).nodes).length) return
  await importOps($, { path: `${EXPORT_DIR}/solution.json` }, true)
}

const modelSummary = (m: SolutionModel) => {
  const ns = Object.values(m.nodes)
  return { nodes: ns.length, open: ns.filter((n) => n.status === 'open').map((n) => n.id).sort(), abandoned: ns.filter((n) => n.status === 'abandoned').map((n) => n.id).sort() }
}

async function inspectReport($: Dollar, g: Graph, focus: Focus): Promise<string> {
  const m = await read($, solutionAtom)
  const blast = blastRadius(g, focus.seeds)
  const rel = relevance(m, g, focus, blast)
  const hl = health(m, g)
  const goal = m.goalId ? m.nodes[m.goalId] : undefined
  const nodes = Object.values(m.nodes)
    .map((n) => ({ id: n.id, kind: n.kind, status: n.status, label: n.label, health: hl.byNode[n.id]?.state ?? 'never-loaded', relevance: rel.weights[n.id] ?? 0 }))
    .sort((a, b) => b.relevance - a.relevance || (a.id < b.id ? -1 : 1))
    .slice(0, INSPECT_SOLUTION_LIMIT)
  const constrained = new Set(m.edges.filter((e) => e.kind === 'constrains').map((e) => e.to))
  const unjustified = Object.values(m.nodes).filter((n) => n.kind === 'decision' && n.status !== 'abandoned' && !constrained.has(n.id)).map((n) => n.id).sort()
  return JSON.stringify({
    goal: goal ? { id: goal.id, label: goal.label } : null,
    nodes,
    open: modelSummary(m).open,
    unjustified,
    touched: rel.touched,
    bearing: rel.bearing,
    reason: rel.reason,
    health: hl.totals,
    evidence: evidenceReport(g, focus, blast),
    export: await exportInfo($),
  })
}

type ImportOutcome = { ok: true; ops: number; applied: number; failed: OpResult[]; dangling: string[]; errors: string[]; model: SolutionModel } | { ok: false; error: string }

/** Import a seed file (path, read with $.fs.read) or inline ops; mode replace starts from an empty model. Never throws. */
async function importOps($: Dollar, src: { path?: string; ops?: SolOp[] }, replace: boolean): Promise<ImportOutcome> {
  let ops = src.ops ?? []
  let errors: string[] = []
  let title: string | undefined
  if (src.path) {
    let text: unknown
    try {
      text = await $.fs.read(resolvePath((await $.session.cwd().catch(() => '')) || '.', src.path))
    } catch (err) {
      return { ok: false, error: `read: ${err instanceof Error ? err.message : String(err)}` }
    }
    if (typeof text !== 'string') return { ok: false, error: `read: ${src.path} is not a text file` }
    const seed = parseSeed(text)
    if (!seed.ops.length && seed.errors.length) return { ok: false, error: seed.errors[0]! }
    ;({ ops, errors } = seed)
    title = seed.title
  }
  const { model, results } = await writeModel($, ops, replace, title)
  const dangling = results.flatMap((r) => (r.warnings ?? []).filter((w) => w.startsWith('dangling:')).map((w) => w.slice('dangling:'.length)))
  return { ok: true, ops: ops.length, applied: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), dangling, errors, model }
}

/** Text outline of the model: goal, then each kind with [ ] open, [x] resolved, ~~abandoned~~. */
function modelOutline(m: SolutionModel): string {
  const ns = Object.values(m.nodes).sort((a, b) => a.createdSeq - b.createdSeq || (a.id < b.id ? -1 : 1))
  if (!ns.length) return 'No solution model yet.'
  const line = (n: SolutionModel['nodes'][string]) => {
    const mark = n.status === 'open' ? '[ ] ' : n.status === 'resolved' ? '[x] ' : ''
    const text = `${n.label} (${n.id})`
    return `  ${mark}${n.status === 'abandoned' ? `~~${text}~~` : text}`
  }
  const goal = m.goalId ? m.nodes[m.goalId] : undefined
  const out = [`Goal: ${goal ? `${goal.label} (${goal.id})` : '(none)'}`]
  const order = ['component', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'decision', 'question'] as const
  for (const k of order) {
    const group = ns.filter((n) => n.kind === k)
    if (group.length) out.push(`${k}:`, ...group.map(line))
  }
  return out.join('\n')
}

/** Resolve a focus request to known transcript or solution ids; unknown ids are reported, never thrown. */
function resolveFocus(g: Graph, m: SolutionModel, match: string | undefined, nodeIds: string[] | undefined): { ids: string[]; unknown: string[] } {
  const ids = new Set(match ? matchNodes(g, match) : [])
  if (match) {
    const q = match.toLowerCase()
    for (const n of Object.values(m.nodes)) if (n.label.toLowerCase().includes(q) || n.id.includes(q)) ids.add(n.id)
  }
  const unknown: string[] = []
  for (const id of nodeIds ?? []) (g.nodes[id] || m.nodes[id] ? ids.add(id) : unknown.push(id))
  return { ids: [...ids].sort(), unknown }
}

async function serveTool($: Dollar, input: Record<string, unknown>): Promise<string> {
  const action = String(input.action ?? '')
  const g = await read($, graphAtom)
  if (action === 'inspect') return inspectReport($, g, await read($, focusAtom))
  if (action === 'add' || action === 'link' || action === 'resolve' || action === 'abandon' || action === 'import') {
    const mapped = toolInputToOps(input)
    if ('error' in mapped) return JSON.stringify({ ok: false, error: mapped.error })
    if (action === 'import') {
      const r = await importOps($, mapped.path ? { path: mapped.path } : { ops: mapped.ops }, mapped.mode === 'replace')
      if (!r.ok) return JSON.stringify(r)
      return JSON.stringify({ ok: true, applied: r.applied, failed: r.failed, dangling: r.dangling, ...(r.errors.length ? { errors: r.errors } : {}), model: modelSummary(r.model), export: await exportInfo($) })
    }
    const { model, results } = await writeModel($, mapped.ops)
    const r: Partial<OpResult> = results[0] ?? { ok: false, error: 'no-op' }
    return JSON.stringify({ ok: r.ok === true, ...(r.id ? { id: r.id } : {}), ...(r.error ? { error: r.error } : {}), ...(r.warnings?.length ? { warnings: r.warnings } : {}), model: modelSummary(model), export: await exportInfo($) })
  }
  if (action === 'clear') {
    await update($, focusAtom, (f) => ({ seeds: [], ...(f.question ? { question: f.question } : {}) }))
    return 'Focus cleared.'
  }
  if (action === 'focus') {
    const match = typeof input.match === 'string' ? input.match : undefined
    const nodeIds = Array.isArray(input.nodeIds) ? input.nodeIds.map(String) : undefined
    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 80) : undefined
    const { ids, unknown } = resolveFocus(g, await read($, solutionAtom), match, nodeIds)
    const tail = unknown.length ? ` Unknown ids: ${unknown.join(', ')}.` : ''
    if (!ids.length) return `No node matches.${tail}`
    const prev = await read($, focusAtom)
    const f = focusOn(g, ids, note)
    if (prev.question) f.question = prev.question
    await update($, focusAtom, () => f)
    const blast = blastRadius(g, f.seeds)
    return `Focused on ${ids.length} nodes (blast: ${Object.keys(blast.weights).length} nodes / ${blast.tokens} tok).${tail}`
  }
  return `Unknown action "${action}". Use ${TOOL_ACTIONS.join(' | ')}.`
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
    if (!e.isMeta && !e.command && !('drop' in r)) {
      await update($, focusAtom, () => ({ seeds: [], question: e.text }))
      // mark the start of this prompt: nodes created after it are "new" and grow in
      await update($, solutionAtom, (m) => (m.promptSeq === m.seq ? m : { ...m, promptSeq: m.seq }))
    }
    return r
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && r.usage) await writeGraph($, (g) => applyTurnUsage(g, r.usage))
    if (e.agentId === undefined) await autoExport($).catch(() => undefined)
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
    const { scene: input, rawView, focus, blast, empty } = await drawInput($)
    const g = input.graph, m = input.model
    const s = stats(g, focus)
    const cols = Math.max(20, Math.min(512, e.props.bodyColumns ?? e.viewport?.columns ?? 80))
    const bodyRows = e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 30
    const ex = await read($, exportAtom)
    const header = summaryLine(solutionSummary(m, input.health))
    const exportState = ex.lastError ? `error: ${ex.lastError}` : ex.lastWrittenAt != null ? `written ${hhmmss(ex.lastWrittenAt)}` : 'not written yet'
    const statusLine = `${header} · export: ${await exportPath($, ex)} (${exportState})`
    const goal = m.goalId ? m.nodes[m.goalId] : undefined
    const open = Object.values(m.nodes).filter((n) => n.status === 'open').sort((a, b) => a.createdSeq - b.createdSeq)
    const alt = `Context graph: ${header}${open.length ? ` · open: ${open.map((n) => n.label).join('; ')}` : ''}`

    let drawing: unknown
    if (e.surface === 'desktop' || e.surface === 'vscode' || e.surface === 'mobile') {
      const { Svg } = $.ui.resolve(e)
      const w = cols * 8, ht = Math.round((w * 3) / 4)
      const source = renderSvg(buildLayeredScene(input, { w, h: ht }), { width: w, height: ht, theme: await svgTheme($) })
      drawing = <Svg source={source} alt={alt} width={w} height={ht} isInteractive />
    } else if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const rows = Math.max(4, Math.min(bodyRows - 4, 60))
      orbit.term = { cols, rows }
      const cells = terminalCells(input, cols, rows)
      drawing = <Raster key="g" columns={cols} rows={rows} cells={cells} />
    } else {
      // text fallback: the goal, open questions and what the current question touches
      const touched = input.relevance.touched.map((id) => m.nodes[id]?.label ?? g.nodes[id]?.label ?? id)
      const top = touched.length ? [] : Object.entries(blast.weights).sort((a, b) => b[1] - a[1]).slice(0, 8)
      drawing = (
        <Box flexDirection="column">
          <Text key="goal">{goal ? `GOAL ${goal.label}` : 'No goal yet'}</Text>
          {open.map((n) => <Text key={`q-${n.id}`}>{`[ ] ${n.label}`}</Text>)}
          {touched.map((l, i) => <Text key={`t-${i}`}>{`touched: ${l}`}</Text>)}
          {top.map(([id, w]) => <Text key={`e-${id}`}>{`${w.toFixed(2)} ${g.nodes[id]?.kind ?? ''} ${g.nodes[id]?.label ?? id}`}</Text>)}
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
    const cycleLayers = () => update($, viewAtom, (v) => ({ ...v, layers: LAYER_CYCLE[v.layers ?? 'both'] }))
    const layersNote = rawView.layers && rawView.layers !== 'both' ? ` · layers ${rawView.layers}` : ''
    const viewLine = `yaw ${Math.round(input.view.yaw)}° · pitch ${Math.round(rawView.pitch)}° · zoom ${rawView.zoom.toFixed(2)}×${rawView.autoOrbit ? ' · orbiting' : ''}${layersNote}`
    return (
      <Box flexDirection="column">
        {empty ? <Text key="hint">{EMPTY_HINT}</Text> : null}
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
          <Button key="layers" label="◫" onPress={cycleLayers} />
        </Box>
        <Text key="view">{viewLine}</Text>
        <Text key="status">{statusLine}</Text>
        <Text key="stats">{s.line}</Text>
      </Box>
    )
  })

  // ------------------------------------------------------------------ command (registered in session.start)
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PLUGIN, description: `Context graph: ${HELP}` })
    await $.tool.register({ name: TOOL, description: TOOL_DESCRIPTION, inputSchema: TOOL_SCHEMA as unknown as Record<string, unknown>, isDeferred: false }).catch(() => undefined)
    if ((await read($, viewAtom)).autoOrbit) startOrbit($)
    await bootstrap($).catch(() => undefined)
    await restoreModel($).catch(() => undefined)
    // pos-1 (or nothing) stored by an older version is declined: lay out afresh when the graph has nodes
    const [pos, g0] = await Promise.all([read($, posAtom), read($, graphAtom)])
    if (!Object.keys(pos.evidence ?? {}).length && Object.keys(g0.nodes).length) await relayout($).catch(() => undefined)
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
        const parts = rest.filter((x) => x !== '--document')
        const path = parts.length ? resolvePath((await $.session.cwd().catch(() => '')) || '.', parts.join(' ')) : await exportPath($)
        const { html, model } = await solutionPage($, rest.includes('--document'))
        await $.fs.write(path, html)
        return { text: `Exported ${Object.keys(model.nodes).length} solution nodes to ${path}.` }
      }
      case 'export-path': {
        if (!arg) return { text: 'Usage: /context-graph export-path <path>' }
        const st = await update($, exportAtom, (cur) => ({ ...cur, path: arg, lastKey: null }))
        return { text: `Export path set to ${await exportPath($, st)}.` }
      }
      case 'reset':
        await update($, graphAtom, () => emptyGraph())
        await update($, posAtom, () => EMPTY_POS)
        await update($, cursorAtom, () => emptyCursor())
        await update($, focusAtom, () => ({ seeds: [] }))
        return { text: 'Graph reset.' }
      case 'import': {
        const parts = rest.filter((x) => x !== '--replace')
        if (!parts.length) return { text: 'Usage: /context-graph import <path> [--replace]' }
        const r = await importOps($, { path: parts.join(' ') }, rest.includes('--replace'))
        if (!r.ok) return { text: `Import failed: ${r.error}` }
        return { text: `Imported ${r.ops} ops (${r.failed.length} failed, ${r.dangling.length} dangling).` }
      }
      case 'help':
        return { text: `/context-graph ${HELP}` }
      case 'model':
        return { text: modelOutline(await read($, solutionAtom)) }
      default:
        return { text: `Unknown subcommand "${sub}". Use ${SUBCOMMANDS.join(' | ')}.` }
    }
  })
}
