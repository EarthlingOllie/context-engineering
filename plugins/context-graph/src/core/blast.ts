// blast: which nodes a question reaches, with weight falling off by hop (design.md 4.2).
import type { BlastRadius, Graph, Seed } from './types.ts'

const OUT_OF_WINDOW_CAP = 0.1
const CENTROID_MIN = 0.5

/**
 * 0-1 BFS over edges treated as undirected from each seed. A turn-turn edge costs no hop, so
 * every turn of a prompt is one hop from it however long the chain. Weight = falloff^hop; the
 * max weight wins across seeds; out-of-window nodes are reached but capped at 0.1.
 * With no seeds the latest prompt is the seed. Deterministic and edge-order independent.
 */
export function blastRadius(g: Graph, seeds: Seed[], opts?: { falloff?: number; maxHops?: number }): BlastRadius {
  const falloff = opts?.falloff ?? 0.5
  const maxHops = opts?.maxHops ?? 3
  // seeds outside the transcript graph (solution ids) are ignored; with none left, the latest prompt is the seed
  const known = seeds.map((s) => s.id).filter((id) => g.nodes[id])
  const seedIds = [...new Set(known.length ? known : g.latestPromptId && g.nodes[g.latestPromptId] ? [g.latestPromptId] : [])].sort()

  const adj = new Map<string, [string, number][]>()
  const link = (a: string, b: string, cost: number) => {
    const list = adj.get(a)
    if (list) list.push([b, cost])
    else adj.set(a, [[b, cost]])
  }
  for (const e of g.edges) {
    if (!g.nodes[e.from] || !g.nodes[e.to]) continue
    const cost = e.kind === 'turn-turn' ? 0 : 1
    link(e.from, e.to, cost)
    link(e.to, e.from, cost)
  }
  for (const list of adj.values()) list.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]))

  const weights: Record<string, number> = {}
  const hops: Record<string, number> = {}
  for (const seed of seedIds) {
    const dist = new Map<string, number>([[seed, 0]])
    const deque = [seed]
    while (deque.length) {
      const id = deque.shift()!
      const d = dist.get(id)!
      for (const [nb, cost] of adj.get(id) ?? []) {
        const nd = d + cost
        if (nd > maxHops || nd >= (dist.get(nb) ?? Infinity)) continue
        dist.set(nb, nd)
        if (cost === 0) deque.unshift(nb)
        else deque.push(nb)
      }
    }
    for (const [id, hop] of dist) {
      const n = g.nodes[id]!
      const w = n.inWindow ? falloff ** hop : Math.min(OUT_OF_WINDOW_CAP, falloff ** hop)
      if (w > (weights[id] ?? -1)) weights[id] = w
      if (hop < (hops[id] ?? Infinity)) hops[id] = hop
    }
  }

  const ids = Object.keys(weights).sort()
  const sortedWeights: Record<string, number> = {}
  const sortedHops: Record<string, number> = {}
  let tokens = 0
  for (const id of ids) {
    sortedWeights[id] = weights[id]!
    sortedHops[id] = hops[id]!
    tokens += g.nodes[id]!.tokens
  }
  return { weights: sortedWeights, hops: sortedHops, seeds: seedIds, tokens, centroidIds: ids.filter((id) => weights[id]! >= CENTROID_MIN) }
}
