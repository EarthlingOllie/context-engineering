// layout: Graph + previous positions -> 3D positions (design.md 4.3).
// Fruchterman-Reingold style: repulsion between all pairs, springs along edges, a weak pull
// to the origin, a z-bias so newer nodes sit further along -z, and out-of-window nodes held
// on an outer shell. Deterministic for a given graph, prev and seed.
import { mulberry32 } from './prng.ts'
import type { Graph, Vec3 } from './types.ts'

const L = 12 // spring rest length / FR k
const BOUND = 1000

export function layout(g: Graph, prev: Record<string, Vec3>, opts?: { iterations?: number; seed?: number }): Record<string, Vec3> {
  const nodes = Object.values(g.nodes).sort((a, b) => a.seq - b.seq || (a.id < b.id ? -1 : 1))
  const n = nodes.length
  if (!n) return {}
  const index = new Map(nodes.map((nd, i) => [nd.id, i]))
  const warm = nodes.some((nd) => prev[nd.id])
  const iterations = opts?.iterations ?? (warm ? 30 : 120)
  const rand = mulberry32(opts?.seed ?? 1)
  const R = L * Math.cbrt(n) * 1.2
  const shell = R * 1.6

  const edges: [number, number][] = []
  const nbrs: number[][] = nodes.map(() => [])
  for (const e of g.edges) {
    const a = index.get(e.from), b = index.get(e.to)
    if (a === undefined || b === undefined || a === b) continue
    edges.push([a, b])
    nbrs[a]!.push(b)
    nbrs[b]!.push(a)
  }

  const x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n)
  const pinned = new Uint8Array(n)
  const placed = new Uint8Array(n)
  const zTarget = (i: number) => R * (0.5 - i / Math.max(1, n - 1)) * 1.5
  for (let i = 0; i < n; i++) {
    const p = prev[nodes[i]!.id]
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
      x[i] = p.x; y[i] = p.y; z[i] = p.z
      pinned[i] = 1; placed[i] = 1
    }
  }
  for (let i = 0; i < n; i++) {
    if (placed[i]) continue
    const j = nbrs[i]!.find((k) => placed[k])
    const jitter = () => (rand() - 0.5) * L
    if (j !== undefined) {
      x[i] = x[j]! + jitter(); y[i] = y[j]! + jitter(); z[i] = z[j]! + jitter()
    } else {
      x[i] = (rand() - 0.5) * R; y[i] = (rand() - 0.5) * R; z[i] = zTarget(i) + jitter()
    }
    placed[i] = 1
  }

  const dx = new Float64Array(n), dy = new Float64Array(n), dz = new Float64Array(n)
  const t0 = warm ? L * 0.5 : R * 0.5
  for (let it = 0; it < iterations; it++) {
    const temp = t0 * (1 - it / iterations) + 0.05
    dx.fill(0); dy.fill(0); dz.fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ex = x[i]! - x[j]!, ey = y[i]! - y[j]!, ez = z[i]! - z[j]!
        let d2 = ex * ex + ey * ey + ez * ez
        if (d2 < 1e-4) { ex = 0.01 * ((i - j) % 3); ey = 0.01; ez = 0; d2 = 1e-4 }
        // k^2/d divided by d to normalise direction; the out-of-window shell barely pushes the live core
        const f = ((L * L) / d2) * (nodes[i]!.inWindow === nodes[j]!.inWindow ? 1 : 0.05)
        dx[i] = dx[i]! + ex * f; dy[i] = dy[i]! + ey * f; dz[i] = dz[i]! + ez * f
        dx[j] = dx[j]! - ex * f; dy[j] = dy[j]! - ey * f; dz[j] = dz[j]! - ez * f
      }
    }
    for (const [a, b] of edges) {
      const ex = x[a]! - x[b]!, ey = y[a]! - y[b]!, ez = z[a]! - z[b]!
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez) + 1e-9
      const f = d / L // = d^2/k divided by d
      dx[a] = dx[a]! - ex * f; dy[a] = dy[a]! - ey * f; dz[a] = dz[a]! - ez * f
      dx[b] = dx[b]! + ex * f; dy[b] = dy[b]! + ey * f; dz[b] = dz[b]! + ez * f
    }
    for (let i = 0; i < n; i++) {
      const nd = nodes[i]!
      if (nd.inWindow) {
        dx[i] = dx[i]! - x[i]! * 0.05; dy[i] = dy[i]! - y[i]! * 0.05; dz[i] = dz[i]! - (z[i]! - zTarget(i)) * 0.1
      } else {
        const r = Math.hypot(x[i]!, y[i]!, z[i]!) + 1e-9
        const f = (shell - r) / r
        dx[i] = dx[i]! + x[i]! * f; dy[i] = dy[i]! + y[i]! * f; dz[i] = dz[i]! + z[i]! * f
      }
      const mag = Math.hypot(dx[i]!, dy[i]!, dz[i]!) + 1e-9
      const step = Math.min(mag, pinned[i] ? 0.1 : temp) / mag
      x[i] = x[i]! + dx[i]! * step; y[i] = y[i]! + dy[i]! * step; z[i] = z[i]! + dz[i]! * step
    }
  }

  const out: Record<string, Vec3> = {}
  const r2 = (v: number) => Math.round(v * 100) / 100
  for (let i = 0; i < n; i++) {
    let px = x[i]!, py = y[i]!, pz = z[i]!
    const m = Math.hypot(px, py, pz)
    if (m > BOUND) { px *= BOUND / m; py *= BOUND / m; pz *= BOUND / m }
    out[nodes[i]!.id] = { x: r2(px), y: r2(py), z: r2(pz) }
  }
  return out
}
