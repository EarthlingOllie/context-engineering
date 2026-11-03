// The decision timeline over the UML log (v3 design.md 4.2, deep module #11). Pure.
import type { SolutionModel } from './solution-types.ts'
import type { UmlElement, UmlModel, UmlOp, UmlRelation } from './uml-types.ts'
import { replayInto } from './uml.ts'

export interface TimelineStep {
  /** 1-based */
  index: number
  decision: string
  /** the decision's solution label (id if unknown); "<label> (abandoned)" for a cascade */
  label: string
  /** this run is an abandon cascade */
  abandoned: boolean
  /** log slice [from, to) */
  from: number
  to: number
  /** targets, unique, in log order; a target is in at most one list (removed > added > changed) */
  changes: { added: string[]; changed: string[]; removed: string[] }
}

export interface UmlSnapshot {
  elements: Record<string, UmlElement>
  relations: Record<string, UmlRelation>
}

/** One step per maximal run of log entries with the same decision and cascade flag. */
export function timeline(u: UmlModel, sol?: SolutionModel): TimelineStep[] {
  const steps: TimelineStep[] = []
  const log = u.log
  let i = 0
  while (i < log.length) {
    const first = log[i]!
    const cascade = Boolean(first.cascade)
    let j = i + 1
    while (j < log.length && log[j]!.decision === first.decision && Boolean(log[j]!.cascade) === cascade) j++
    const state = new Map<string, 'added' | 'changed' | 'removed'>()
    for (let k = i; k < j; k++) {
      const e = log[k]!
      const prev = state.get(e.target)
      if (e.change === 'removed') state.set(e.target, 'removed')
      else if (prev === undefined) state.set(e.target, e.change)
      else if (prev === 'removed') state.set(e.target, e.change === 'added' ? 'added' : 'changed')
    }
    const changes: TimelineStep['changes'] = { added: [], changed: [], removed: [] }
    for (const [t, c] of state) changes[c].push(t)
    const base = sol?.nodes[first.decision]?.label ?? first.decision
    steps.push({ index: steps.length + 1, decision: first.decision, label: cascade ? `${base} (abandoned)` : base, abandoned: cascade, from: i, to: j, changes })
    i = j
  }
  return steps
}

type Replay = { elements: Record<string, UmlElement>; relations: Record<string, UmlRelation>; seq: number }
/** Last replayed state per model: successive snapshotAt calls replay incrementally. */
const cache = new WeakMap<UmlModel, { steps: TimelineStep[]; at: number; work: Replay }>()
const fresh = (): Replay => ({ elements: {}, relations: {}, seq: 0 })

/** The design as it stood after step `step` (0 = empty); clamps to [0, steps]. Each call returns fresh records. */
export function snapshotAt(u: UmlModel, step: number): UmlSnapshot {
  let c = cache.get(u)
  if (!c) {
    c = { steps: timeline(u), at: 0, work: fresh() }
    cache.set(u, c)
  }
  const n = c.steps.length
  const k = Math.max(0, Math.min(n, Math.floor(Number.isFinite(step) ? step : 0)))
  if (k < c.at) {
    c.at = 0
    c.work = fresh()
  }
  if (k > c.at) {
    const from = c.at === 0 ? 0 : c.steps[c.at - 1]!.to
    const to = c.steps[k - 1]!.to
    const ops: UmlOp[] = []
    for (let i = from; i < to; i++) ops.push(u.log[i]!.op)
    replayInto(c.work, ops)
    c.at = k
  }
  return { elements: { ...c.work.elements }, relations: { ...c.work.relations } }
}
