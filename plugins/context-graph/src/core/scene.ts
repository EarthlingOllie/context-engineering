// scene: graph + positions + blast + view -> screen-space Scene (design.md 4.8).
// Owns the kind palette, the radius rule, edge weighting and camera auto-fit on the blast radius.
import { makeProjector } from './camera.ts'
import type { BlastRadius, Focus, Graph, NodeKind, SeedSource, Vec3, View } from './types.ts'

export interface SceneItem {
  id: string
  kind: NodeKind
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
}
export interface SceneEdge { x1: number; y1: number; x2: number; y2: number; weight: number; depth: number }
export interface Scene {
  width: number
  height: number
  items: SceneItem[]
  edges: SceneEdge[]
  legend: { tokensInRadius: number; totalTokens: number; windowTokens?: number; note?: string; nodes: number; blastNodes: number }
}

/** 0xRRGGBB per kind. */
export const KIND_COLORS: Record<NodeKind, number> = {
  system: 0x8a8f98,
  prompt: 0xf2b84b,
  turn: 0x6ea8fe,
  tool: 0x5ccf91,
  file: 0xc792ea,
  compaction: 0xef6f6c,
}

const R_K = 0.3 // world units per sqrt(token)
export const R_MIN = 2
export const R_MAX = 40
const FIT = 0.6

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
  // Back off (up to 2.5x) so in-window nodes outside the blast radius stay in front of the camera.
  let reach = 0
  for (const n of Object.values(g.nodes)) {
    const p = positions[n.id]
    if (n.inWindow && p) reach = Math.max(reach, Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z))
  }
  const autoDistance = Math.min(fitDistance * 2.5, Math.max(fitDistance, reach * 1.1))
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
