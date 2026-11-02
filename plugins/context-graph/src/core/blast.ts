// blast: which nodes a question reaches, with weight falling off by hop (design.md 4.2).
import type { BlastRadius, Graph, Seed } from './types.ts'

const OUT_OF_WINDOW_CAP = 0.1
const CENTROID_MIN = 0.5

/**
 * BFS over edges treated as undirected from each seed. Weight = falloff^hop; the max
 * weight wins across seeds; out-of-window nodes are reached but capped at 0.1.
 * With no seeds the latest prompt is the seed. Deterministic and edge-order independent.
 */
export function blastRadius(g: Graph, seeds: Seed[], opts?: { falloff?: number; maxHops?: number }): BlastRadius {
  const falloff = opts?.falloff ?? 0.5
  const maxHops = opts?.maxHops ?? 3
  const seedIds = [...new Set((seeds.length ? seeds.map((s) => s.id) : g.latestPromptId ? [g.latestPromptId] : []).filter((id) => g.nodes[id]))].sort()

  const adj = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    const list = adj.get(a)
    if (list) list.push(b)
    else adj.set(a, [b])
  }
  for (const e of g.edges) {
    if (!g.nodes[e.from] || !g.nodes[e.to]) continue
    link(e.from, e.to)
    link(e.to, e.from)
  }
  for (const list of adj.values()) list.sort()

  const weights: Record<string, number> = {}
  const hops: Record<string, number> = {}
  for (const seed of seedIds) {
    const seen = new Map<string, number>([[seed, 0]])
    let frontier = [seed]
    for (let hop = 0; frontier.length && hop <= maxHops; hop++) {
      const next: string[] = []
      for (const id of frontier) {
        const n = g.nodes[id]!
        const w = n.inWindow ? falloff ** hop : Math.min(OUT_OF_WINDOW_CAP, falloff ** hop)
        if (w > (weights[id] ?? -1)) weights[id] = w
        if (hop < (hops[id] ?? Infinity)) hops[id] = hop
        for (const nb of adj.get(id) ?? []) {
          if (!seen.has(nb)) {
            seen.set(nb, hop + 1)
            next.push(nb)
          }
        }
      }
      frontier = next
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
