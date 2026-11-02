// Context health of each solution node, from where its evidence sits (v2 design.md 4.4, deep module #8).
import type { Graph, SolutionModel } from './types.ts'

export type Health = 'in-window' | 'compacted' | 'never-loaded'
export interface NodeHealth {
  state: Health
  inWindow: number
  compacted: number
  missing: number
}
export interface HealthReport {
  byNode: Record<string, NodeHealth>
  totals: Record<Health, number>
}

/**
 * A supported-by target is in-window (in g, inWindow), compacted (in g, not inWindow) or missing (not in g).
 * Node state: in-window if any target is; else compacted if any is; else never-loaded (incl. no evidence).
 * Abandoned nodes are reported in byNode but left out of totals.
 */
export function health(m: SolutionModel, g: Graph): HealthReport {
  const byNode: Record<string, NodeHealth> = {}
  for (const id of Object.keys(m.nodes)) byNode[id] = { state: 'never-loaded', inWindow: 0, compacted: 0, missing: 0 }
  for (const e of m.edges) {
    if (e.kind !== 'supported-by') continue
    const h = byNode[e.from]
    if (!h) continue
    const n = g.nodes[e.to]
    if (!n) h.missing++
    else if (n.inWindow) h.inWindow++
    else h.compacted++
  }
  const totals: Record<Health, number> = { 'in-window': 0, compacted: 0, 'never-loaded': 0 }
  for (const [id, h] of Object.entries(byNode)) {
    h.state = h.inWindow > 0 ? 'in-window' : h.compacted > 0 ? 'compacted' : 'never-loaded'
    if (m.nodes[id]!.status !== 'abandoned') totals[h.state]++
  }
  return { byNode, totals }
}
