// layers: layered 3D layout (v2 design.md 4.5, deep module #9).
// Solution layer: goal at the origin, every other node on a ring in the plane y~0 whose radius
// is set by its kind band (abandoned nodes sit further out). Angles come from a small angular
// force pass: repulsion within a ring, springs along solution edges. Evidence layer: v1 `layout`
// squashed into a disc of radius EVIDENCE_RADIUS on the plane y = EVIDENCE_Y.
import { layout } from './layout.ts'
import { mulberry32 } from './prng.ts'
import type { Graph, SolKind, SolutionModel, Vec3 } from './types.ts'

export const LAYER = {
  SOLUTION_Y: 0,
  EVIDENCE_Y: -300,
  EVIDENCE_RADIUS: 320,
  RINGS: { component: 120, decision: 200, factor: 280, question: 280, abandonedExtra: 60 },
} as const

export interface LayerPositions {
  solution: Record<string, Vec3>
  evidence: Record<string, Vec3>
}

const Y_JITTER = 18 // stays inside the +-20 band
const EVIDENCE_Y_HALF = 36 // stays inside the +-40 band
const WARM_MAX_SHIFT = 10 // units of arc a pre-existing node may move on a warm run
const TAU = Math.PI * 2

type Band = 'component' | 'decision' | 'factor' | 'question'
function band(kind: SolKind): Band | null {
  if (kind === 'goal') return null
  if (kind === 'component' || kind === 'decision' || kind === 'question') return kind
  return 'factor'
}

/** FNV-1a of a string, mixed with the seed: stable per-node jitter that survives warm runs. */
function hash(s: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  return h / 4294967296
}

const wrap = (a: number) => ((a % TAU) + TAU + Math.PI) % TAU - Math.PI // -> [-pi, pi)
const r2 = (v: number) => Math.round(v * 100) / 100

export function layoutLayers(m: SolutionModel, g: Graph, prev: LayerPositions, opts?: { seed?: number; iterations?: number }): LayerPositions {
  const seed = opts?.seed ?? 1
  return { solution: layoutSolution(m, prev.solution ?? {}, seed, opts?.iterations), evidence: layoutEvidence(g, prev.evidence ?? {}, seed) }
}

function layoutSolution(m: SolutionModel, prev: Record<string, Vec3>, seed: number, iterations?: number): Record<string, Vec3> {
  const out: Record<string, Vec3> = {}
  const all = Object.values(m.nodes).sort((a, b) => a.createdSeq - b.createdSeq || (a.id < b.id ? -1 : 1))
  const ring = all.filter((nd) => band(nd.kind) !== null)
  for (const nd of all) if (nd.kind === 'goal') out[nd.id] = { x: 0, y: LAYER.SOLUTION_Y, z: 0 }
  const n = ring.length
  if (!n) return out

  const index = new Map(ring.map((nd, i) => [nd.id, i]))
  const radius = ring.map((nd) => LAYER.RINGS[band(nd.kind)!] + (nd.status === 'abandoned' ? LAYER.RINGS.abandonedExtra : 0))
  const nbrs: number[][] = ring.map(() => [])
  const springs: [number, number][] = []
  for (const e of m.edges) {
    const a = index.get(e.from), b = index.get(e.to)
    if (a === undefined || b === undefined || a === b) continue
    springs.push([a, b])
    nbrs[a]!.push(b)
    nbrs[b]!.push(a)
  }

  // Initial angles: keep the previous angle when the node was placed before; otherwise spawn
  // next to the first already-placed neighbour, or spread around the ring.
  const theta = new Float64Array(n)
  const placed = new Uint8Array(n)
  const anchor = new Float64Array(n)
  const pinned = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const p = prev[ring[i]!.id]
    if (p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.hypot(p.x, p.z) > 1e-6) {
      theta[i] = Math.atan2(p.z, p.x); anchor[i] = theta[i]!
      placed[i] = 1; pinned[i] = 1
    }
  }
  const warm = pinned.some((v) => v === 1)
  const rand = mulberry32(seed)
  for (let i = 0; i < n; i++) {
    if (placed[i]) continue
    const j = nbrs[i]!.find((k) => placed[k])
    const jitter = (rand() - 0.5) * 0.4
    theta[i] = j !== undefined ? wrap(theta[j]! + jitter) : wrap((i / n) * TAU * 2.618 + jitter)
    placed[i] = 1
  }

  // Angular force pass. Nodes on the same radius repel by angle; edges pull angles together.
  const iters = iterations ?? (warm ? 30 : n > 100 ? 60 : 120)
  const f = new Float64Array(n)
  const pairList: number[] = []
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (radius[i] === radius[j]) pairList.push(i, j)
  const pairs = Int32Array.from(pairList)
  for (let it = 0; it < iters; it++) {
    const temp = (warm ? 0.05 : 0.6) * (1 - it / iters) + 0.005
    f.fill(0)
    for (let k = 0; k < pairs.length; k += 2) {
      const i = pairs[k]!, j = pairs[k + 1]!
      let d = theta[i]! - theta[j]! // both in [-pi, pi): one fold brings d into range
      if (d >= Math.PI) d -= TAU
      else if (d < -Math.PI) d += TAU
      if (d < 1e-4 && d > -1e-4) d = 1e-4
      const push = 0.02 / (d * (d < 0 ? -d : d)) // 1/d^2 away from the other node
      f[i] = f[i]! + push; f[j] = f[j]! - push
    }
    for (const [a, b] of springs) {
      const d = wrap(theta[b]! - theta[a]!)
      f[a] = f[a]! + d * 0.1; f[b] = f[b]! - d * 0.1
    }
    for (let i = 0; i < n; i++) {
      const lim = pinned[i] ? Math.min(temp, 0.01) : temp
      const step = Math.max(-lim, Math.min(lim, f[i]!))
      theta[i] = wrap(theta[i]! + step)
    }
  }

  for (let i = 0; i < n; i++) {
    if (pinned[i]) {
      // Clamp warm drift so the shape stays where the viewer last saw it.
      const maxA = WARM_MAX_SHIFT / radius[i]!
      const d = wrap(theta[i]! - anchor[i]!)
      theta[i] = anchor[i]! + Math.max(-maxA, Math.min(maxA, d))
    }
    const nd = ring[i]!
    const y = LAYER.SOLUTION_Y + (hash(nd.id, seed) - 0.5) * 2 * Y_JITTER
    out[nd.id] = { x: r2(radius[i]! * Math.cos(theta[i]!)), y: r2(y), z: r2(radius[i]! * Math.sin(theta[i]!)) }
  }
  return out
}

/** v1 layout -> disc. A fixed scale from the node count (not the data extent) keeps the map invertible for warm starts. */
function layoutEvidence(g: Graph, prev: Record<string, Vec3>, seed: number): Record<string, Vec3> {
  const n = Object.keys(g.nodes).length
  if (!n) return {}
  const extent = 12 * Math.cbrt(n) * 1.2 * 1.6 * 1.15 // v1 outer shell with headroom
  const sh = (LAYER.EVIDENCE_RADIUS * 0.95) / extent
  const sv = EVIDENCE_Y_HALF / extent
  const back: Record<string, Vec3> = {}
  for (const [id, p] of Object.entries(prev)) back[id] = { x: p.x / sh, y: (p.y - LAYER.EVIDENCE_Y) / sv, z: p.z / sh }
  const raw = layout(g, back, { seed, iterations: n > 250 ? (Object.keys(back).length ? 12 : 24) : undefined })
  const out: Record<string, Vec3> = {}
  for (const [id, p] of Object.entries(raw)) {
    let x = p.x * sh, z = p.z * sh
    const r = Math.hypot(x, z)
    const cap = LAYER.EVIDENCE_RADIUS - 0.5 // headroom for rounding
    if (r > cap) { x *= cap / r; z *= cap / r }
    const y = Math.max(-EVIDENCE_Y_HALF, Math.min(EVIDENCE_Y_HALF, p.y * sv))
    out[id] = { x: r2(x), y: r2(LAYER.EVIDENCE_Y + y), z: r2(z) }
  }
  return out
}
