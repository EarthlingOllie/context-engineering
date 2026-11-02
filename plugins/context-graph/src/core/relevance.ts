// Relevance: which parts of the solution the current question touches (v2 design.md 4.3, deep module #7).
import type { BlastRadius, Focus, Graph, SolEdgeKind, SolutionModel } from './types.ts'

export interface Relevance {
  weights: Record<string, number>
  touched: string[]
  bearing: string[]
  reason: 'model' | 'prompt' | 'recent' | 'none'
}

export const REL = { touched: 1, bearing: 0.7, near: 0.35, goal: 0.5, rest: 0.12, abandonedCap: 0.4, abandoned: 0.08, evidence: 0.6, promptMin: 0.25 } as const
const WALK: ReadonlySet<SolEdgeKind> = new Set(['constrains', 'decided-by', 'depends-on', 'contradicts'])

/**
 * Touched (1): model-focus solution seeds, else nodes whose supported-by evidence the prompt blast reaches
 * (>= 0.25), else nodes changed since the prompt began. Bearing (0.7): solution nodes one hop from a touched
 * node over constrains / decided-by / depends-on / contradicts, either direction. Two hops 0.35; the goal at
 * least 0.5; the rest 0.12. Abandoned: capped at 0.4 when touched/bearing, else 0.08. Evidence ids keep
 * 0.6 x their blast weight. An empty model returns no weights (the shell fades evidence by blast alone).
 * Deterministic and independent of edge order.
 */
export function relevance(m: SolutionModel, _g: Graph, focus: Focus, blast: BlastRadius): Relevance {
  const ids = Object.keys(m.nodes).sort()
  if (!ids.length) return { weights: {}, touched: [], bearing: [], reason: 'none' }

  let reason: Relevance['reason'] = 'none'
  let touched = [...new Set(focus.seeds.filter((s) => s.source === 'model' && m.nodes[s.id]).map((s) => s.id))]
  if (touched.length) reason = 'model'
  else {
    const hit = new Set<string>()
    for (const e of m.edges) if (e.kind === 'supported-by' && m.nodes[e.from] && (blast.weights[e.to] ?? 0) >= REL.promptMin) hit.add(e.from)
    touched = [...hit]
    if (touched.length) reason = 'prompt'
    else {
      touched = ids.filter((id) => m.nodes[id]!.updatedSeq > m.promptSeq)
      if (touched.length) reason = 'recent'
    }
  }
  touched.sort()

  const adj = new Map<string, Set<string>>()
  const add = (a: string, b: string) => (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b)
  for (const e of m.edges) {
    if (!WALK.has(e.kind) || !m.nodes[e.from] || !m.nodes[e.to]) continue
    add(e.from, e.to)
    add(e.to, e.from)
  }
  const ring = (from: Iterable<string>, seen: Set<string>) => {
    const out = new Set<string>()
    for (const a of from) for (const b of adj.get(a) ?? []) if (!seen.has(b)) out.add(b)
    return out
  }
  const touchedSet = new Set(touched)
  const hop1 = ring(touchedSet, touchedSet)
  const hop2 = ring(hop1, new Set([...touchedSet, ...hop1]))
  const bearing = [...hop1].sort()

  const weights: Record<string, number> = {}
  for (const [id, w] of Object.entries(blast.weights)) if (!m.nodes[id]) weights[id] = round(w * REL.evidence)
  for (const id of ids) {
    const n = m.nodes[id]!
    let w: number = touchedSet.has(id) ? REL.touched : hop1.has(id) ? REL.bearing : hop2.has(id) ? REL.near : REL.rest
    if (id === m.goalId) w = Math.max(w, REL.goal)
    if (n.status === 'abandoned') w = touchedSet.has(id) || hop1.has(id) ? Math.min(w, REL.abandonedCap) : REL.abandoned
    weights[id] = w
  }
  return { weights, touched, bearing, reason }
}

const round = (x: number) => Math.round(x * 1e6) / 1e6
