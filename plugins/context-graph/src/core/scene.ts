// scene: graph + positions + blast + view -> screen-space Scene (design.md 4.8).
// Owns the kind palette, the radius rule, edge weighting and camera auto-fit on the blast radius.
import { makeProjector } from './camera.ts'
import type { BlastRadius, Focus, Graph, NodeKind, SeedSource, SolEdgeKind, SolKind, SolStatus, SolutionModel, Vec3, View } from './types.ts'
import type { Health, HealthReport } from './health.ts'
import type { Relevance } from './relevance.ts'

export type Shape = 'goal' | 'circle' | 'square' | 'triangle' | 'diamond' | 'hex' | 'cross' | 'question'

export interface SceneItem {
  id: string
  kind: NodeKind | SolKind
  label: string
  tokens: number
  x: number
  y: number
  depth: number
  r: number
  weight: number
  hop?: number
  inWindow: boolean
  color: number
  seed?: SeedSource
  // v2 layered scene only
  layer?: 'solution' | 'evidence'
  shape?: Shape
  status?: SolStatus
  health?: Health
  /** supported-by targets by where they sit: in window / compacted / missing */
  evidence?: { inWindow: number; compacted: number; missing: number }
  isNew?: boolean
  kindLabel?: string
  /** always draw this item's label (goal, components, decisions, open questions, top evidence) */
  labelled?: boolean
  /** evidence item that some solution node cites (supported-by target) */
  cited?: boolean
}
export interface SceneEdge {
  x1: number; y1: number; x2: number; y2: number; weight: number; depth: number
  // v2 layered scene only
  kind?: SolEdgeKind | 'evidence'
  layer?: 'solution' | 'evidence'
  from?: string
  to?: string
}
export interface SolutionSummary {
  goal?: string
  components: number
  decisions: number
  openQuestions: number
  health: { inWindow: number; compacted: number; missing: number }
  kinds: SolKind[]
}
export interface Scene {
  width: number
  height: number
  items: SceneItem[]
  edges: SceneEdge[]
  legend: { tokensInRadius: number; totalTokens: number; windowTokens?: number; note?: string; nodes: number; blastNodes: number; solution?: SolutionSummary }
}

/** 0xRRGGBB per kind. Solution kinds keep >= 3:1 contrast on both #0d1117 and #ffffff. */
export const KIND_COLORS: Record<NodeKind | SolKind, number> = {
  system: 0x8a8f98,
  prompt: 0xf2b84b,
  turn: 0x6ea8fe,
  tool: 0x5ccf91,
  file: 0xc792ea,
  compaction: 0xef6f6c,
  goal: 0xb07c00,
  component: 0x1f9e9e,
  decision: 0x3b82e0,
  requirement: 0x2f9e4f,
  constraint: 0xd0700a,
  assumption: 0x9a6ad6,
  dependency: 0x6e7f96,
  risk: 0xe0484a,
  question: 0xc84aa8,
}
/** Solution kinds whose colour is already legible on both grounds (renderers must not re-shade them). */
export const SOL_COLOR_KINDS: ReadonlySet<string> = new Set(['goal', 'component', 'decision', 'requirement', 'constraint', 'assumption', 'dependency', 'risk', 'question'])

export const SHAPES: Record<SolKind, Shape> = {
  goal: 'goal', component: 'circle', decision: 'square', requirement: 'triangle', constraint: 'diamond',
  assumption: 'diamond', dependency: 'hex', risk: 'cross', question: 'question',
}

const R_K = 0.3 // world units per sqrt(token)
export const R_MIN = 2
export const R_MAX = 40
const FIT = 0.6
/** bottom strip reserved for the legend line */
export const LEGEND_PX = 16

export function nodeRadius(tokens: number, scale: number): number {
  return Math.max(R_MIN, Math.min(R_MAX, R_K * Math.sqrt(Math.max(1, tokens)) * scale))
}

export interface SceneInput {
  graph: Graph
  positions: Record<string, Vec3>
  blast: BlastRadius
  view: View & { zoom?: number }
  focus?: Focus
}

export function buildScene(input: SceneInput, size: { w: number; h: number }): Scene {
  const { graph: g, positions, blast, view, focus } = input
  const placed = (ids: string[]) => ids.filter((id) => positions[id] && g.nodes[id])
  let frame = placed(blast.centroidIds)
  if (!frame.length) frame = placed(Object.values(g.nodes).filter((n) => n.inWindow).map((n) => n.id))
  if (!frame.length) frame = placed(Object.keys(g.nodes))

  const target: Vec3 = { x: 0, y: 0, z: 0 }
  for (const id of frame) {
    const p = positions[id]!
    target.x += p.x / frame.length; target.y += p.y / frame.length; target.z += p.z / frame.length
  }
  let radius = 0
  for (const id of frame) {
    const p = positions[id]!
    radius = Math.max(radius, Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z))
  }
  const tanV = Math.tan((view.fov * Math.PI) / 360)
  const tanMin = Math.min(tanV, tanV * (size.w / Math.max(1, size.h)))
  const fitDistance = Math.max(radius, 8) / (FIT * tanMin) + Math.max(radius, 8)
  // Back off until every in-window and blast node (with its radius) sits inside the frame, above the legend strip.
  const must = Object.values(g.nodes).filter((n) => positions[n.id] && (n.inWindow || (blast.weights[n.id] ?? 0) > 0))
  const fits = (d: number) => {
    const pr = makeProjector({ ...view, distance: d }, target, size)
    for (const n of must) {
      const q = pr(positions[n.id]!)
      if (!q.visible) return false
      const r = nodeRadius(n.tokens, q.scale) + 2
      if (q.x - r < 0 || q.x + r > size.w || q.y - r < 0 || q.y + r > size.h - LEGEND_PX) return false
    }
    return true
  }
  let autoDistance = fitDistance
  for (let k = 0; k < 40 && !fits(autoDistance); k++) autoDistance *= 1.12
  const distance = autoDistance / Math.max(0.25, Math.min(4, view.zoom ?? 1))
  const project = makeProjector({ ...view, distance }, target, size)

  const seedSource = new Map<string, SeedSource>()
  if (focus?.seeds.length) for (const s of focus.seeds) seedSource.set(s.id, s.source)
  for (const id of blast.seeds) if (!seedSource.has(id)) seedSource.set(id, 'prompt')

  const screen = new Map<string, { x: number; y: number; depth: number; weight: number }>()
  const items: SceneItem[] = []
  let totalTokens = 0
  for (const n of Object.values(g.nodes)) {
    if (n.inWindow) totalTokens += n.tokens
    const p = positions[n.id]
    if (!p) continue
    const pr = project(p)
    if (!pr.visible) continue
    const weight = blast.weights[n.id] ?? 0
    screen.set(n.id, { x: pr.x, y: pr.y, depth: pr.depth, weight })
    const item: SceneItem = {
      id: n.id, kind: n.kind, label: n.label, tokens: n.tokens,
      x: pr.x, y: pr.y, depth: pr.depth, r: nodeRadius(n.tokens, pr.scale),
      weight, inWindow: n.inWindow, color: KIND_COLORS[n.kind],
    }
    const hop = blast.hops[n.id]
    if (hop !== undefined) item.hop = hop
    const seed = blast.seeds.includes(n.id) ? seedSource.get(n.id) : undefined
    if (seed) item.seed = seed
    items.push(item)
  }
  items.sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : 1))

  const edges: SceneEdge[] = []
  for (const e of g.edges) {
    const a = screen.get(e.from), b = screen.get(e.to)
    if (!a || !b) continue
    edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, weight: Math.min(a.weight, b.weight), depth: (a.depth + b.depth) / 2 })
  }
  edges.sort((a, b) => b.depth - a.depth)

  const legend: Scene['legend'] = { tokensInRadius: blast.tokens, totalTokens, nodes: Object.keys(g.nodes).length, blastNodes: Object.keys(blast.weights).length }
  const wt = g.latestTurnId ? g.nodes[g.latestTurnId]?.meta?.windowTokens : undefined
  if (wt) legend.windowTokens = wt
  if (focus?.note) legend.note = focus.note
  return { width: size.w, height: size.h, items, edges, legend }
}

// ---------------------------------------------------------------------------------------------
// v2 layered scene (design.md 4.6): solution layer over the evidence layer, one camera.

export interface LayeredSceneInput {
  model: SolutionModel
  graph: Graph
  positions: { solution: Record<string, Vec3>; evidence: Record<string, Vec3> }
  relevance: Relevance
  health: HealthReport
  view: View & { zoom?: number }
  layers: 'both' | 'solution' | 'evidence'
  note?: string
}

/** world radius of a solution node by kind */
const SOL_R: Record<SolKind, number> = { goal: 16, component: 11, decision: 9, requirement: 8, constraint: 8, assumption: 8, dependency: 8, risk: 8, question: 8 }
const SOL_LABELS = 24
const EVIDENCE_LABELS = 6
/** top strip reserved for the header line */
export const HEADER_PX = 18
const LABEL_RANK: Partial<Record<SolKind, number>> = { goal: 0, question: 1, component: 2, decision: 3 }

export function buildLayeredScene(input: LayeredSceneInput, size: { w: number; h: number }): Scene {
  const { model: m, graph: g, positions, relevance: rel, health: hl, view, layers } = input
  const showSol = layers !== 'evidence', showEv = layers !== 'solution'
  const pos = new Map<string, Vec3>()
  if (showSol) for (const id of Object.keys(m.nodes)) { const p = positions.solution[id]; if (p) pos.set(id, p) }
  if (showEv) for (const id of Object.keys(g.nodes)) { const p = positions.evidence[id]; if (p) pos.set(id, p) }

  // Camera target: touched + bearing, else the goal, else the centroid of what is drawn.
  let frame = [...rel.touched, ...rel.bearing].filter((id) => pos.has(id))
  if (!frame.length && m.goalId && pos.has(m.goalId)) frame = [m.goalId]
  if (!frame.length) frame = [...pos.keys()]
  const target: Vec3 = { x: 0, y: 0, z: 0 }
  for (const id of frame) {
    const p = pos.get(id)!
    target.x += p.x / frame.length; target.y += p.y / frame.length; target.z += p.z / frame.length
  }
  let radius = 8
  for (const p of pos.values()) radius = Math.max(radius, Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z))
  const worldR = (id: string) => (m.nodes[id] ? SOL_R[m.nodes[id]!.kind] : 2)
  const fits = (d: number) => {
    const pr = makeProjector({ ...view, distance: d }, target, size)
    for (const [id, p] of pos) {
      const q = pr(p)
      if (!q.visible) return false
      const r = worldR(id) * q.scale + 2
      if (q.x - r < 0 || q.x + r > size.w || q.y - r < HEADER_PX || q.y + r > size.h - LEGEND_PX) return false
    }
    return true
  }
  // Start just outside the bounding sphere and back off in small steps: the tightest framing that fits.
  let autoDistance = radius * 1.05 + 1
  for (let k = 0; k < 120 && !fits(autoDistance); k++) autoDistance *= 1.04
  const distance = autoDistance / Math.max(0.25, Math.min(4, view.zoom ?? 1))
  const project = makeProjector({ ...view, distance }, target, size)

  const cited = new Set<string>()
  for (const e of m.edges) if (e.kind === 'supported-by') cited.add(e.to)

  const screen = new Map<string, { x: number; y: number; depth: number; weight: number }>()
  const items: SceneItem[] = []
  let totalTokens = 0
  if (showSol) for (const n of Object.values(m.nodes)) {
    const p = pos.get(n.id)
    if (!p) continue
    const q = project(p)
    if (!q.visible) continue
    const weight = rel.weights[n.id] ?? 0
    screen.set(n.id, { x: q.x, y: q.y, depth: q.depth, weight })
    const h = hl.byNode[n.id]
    const item: SceneItem = {
      id: n.id, kind: n.kind, label: n.label, tokens: 0, x: q.x, y: q.y, depth: q.depth,
      r: Math.max(3, Math.min(28, SOL_R[n.kind] * q.scale)), weight, inWindow: true, color: KIND_COLORS[n.kind],
      layer: 'solution', shape: SHAPES[n.kind], status: n.status, health: h?.state ?? 'never-loaded',
      evidence: { inWindow: h?.inWindow ?? 0, compacted: h?.compacted ?? 0, missing: h?.missing ?? 0 },
      isNew: n.createdSeq > m.promptSeq, kindLabel: n.kind,
    }
    items.push(item)
  }
  for (const n of Object.values(g.nodes)) {
    if (n.inWindow) totalTokens += n.tokens
    if (!showEv) continue
    const p = pos.get(n.id)
    if (!p) continue
    const q = project(p)
    if (!q.visible) continue
    const weight = rel.weights[n.id] ?? 0
    screen.set(n.id, { x: q.x, y: q.y, depth: q.depth, weight })
    const item: SceneItem = {
      id: n.id, kind: n.kind, label: n.label, tokens: n.tokens, x: q.x, y: q.y, depth: q.depth,
      r: Math.max(1.5, nodeRadius(n.tokens, q.scale) * 0.5), weight, inWindow: n.inWindow, color: KIND_COLORS[n.kind], layer: 'evidence',
    }
    if (cited.has(n.id)) item.cited = true
    items.push(item)
  }

  // Labels: goal, open questions, components, decisions (cap 24); the 6 strongest evidence nodes.
  const solLab = items
    .filter((i) => i.layer === 'solution' && LABEL_RANK[i.kind as SolKind] !== undefined && (i.kind !== 'question' || i.status === 'open'))
    .sort((a, b) => LABEL_RANK[a.kind as SolKind]! - LABEL_RANK[b.kind as SolKind]! || b.weight - a.weight || (a.id < b.id ? -1 : 1))
    .slice(0, SOL_LABELS)
  for (const i of solLab) i.labelled = true
  const evLab = items.filter((i) => i.layer === 'evidence' && i.weight > 0)
    .sort((a, b) => b.weight - a.weight || b.tokens - a.tokens || (a.id < b.id ? -1 : 1)).slice(0, EVIDENCE_LABELS)
  for (const i of evLab) i.labelled = true
  items.sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : 1))

  const edges: SceneEdge[] = []
  const pushEdge = (from: string, to: string, kind: SceneEdge['kind'], layer: 'solution' | 'evidence') => {
    const a = screen.get(from), b = screen.get(to)
    if (!a || !b) return
    edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, weight: Math.min(a.weight, b.weight), depth: (a.depth + b.depth) / 2, kind, layer, from, to })
  }
  for (const e of m.edges) pushEdge(e.from, e.to, e.kind, 'solution')
  if (showEv) for (const e of g.edges) pushEdge(e.from, e.to, 'evidence', 'evidence')
  edges.sort((a, b) => b.depth - a.depth)

  const solution = solutionSummary(m, hl)
  const blastIds = Object.keys(rel.weights).filter((id) => g.nodes[id] && rel.weights[id]! > 0)
  const legend: Scene['legend'] = {
    tokensInRadius: blastIds.reduce((a, id) => a + g.nodes[id]!.tokens, 0), totalTokens,
    nodes: Object.keys(g.nodes).length, blastNodes: blastIds.length, solution,
  }
  const wt = g.latestTurnId ? g.nodes[g.latestTurnId]?.meta?.windowTokens : undefined
  if (wt) legend.windowTokens = wt
  if (input.note) legend.note = input.note
  return { width: size.w, height: size.h, items, edges, legend }
}

/** Header counts for the solution layer: live components/decisions/open questions, health totals, kinds present. */
export function solutionSummary(m: SolutionModel, hl: HealthReport): SolutionSummary {
  const nodes = Object.values(m.nodes)
  const live = nodes.filter((n) => n.status !== 'abandoned')
  const kinds = [...new Set(nodes.map((n) => n.kind))].sort((a, b) => Object.keys(SHAPES).indexOf(a) - Object.keys(SHAPES).indexOf(b))
  const solution: SolutionSummary = {
    components: live.filter((n) => n.kind === 'component').length,
    decisions: live.filter((n) => n.kind === 'decision').length,
    openQuestions: live.filter((n) => n.kind === 'question' && n.status === 'open').length,
    health: { inWindow: hl.totals['in-window'], compacted: hl.totals.compacted, missing: hl.totals['never-loaded'] },
    kinds,
  }
  if (m.goalId && m.nodes[m.goalId]) solution.goal = m.nodes[m.goalId]!.label
  return solution
}
