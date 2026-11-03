// One diagram for both renderers (v3 design.md 4.5, deep module #14). Pure.
// buildDiagram turns the UML model at a timeline step, plus an optional scan of the code, into a flat list of
// flagged, change-marked elements and relations; umlPageData precomputes every step for the Artifact page.
import type { ActualDesign } from './codeScan.ts'
import { crossCheck, UML_FLAGS } from './crossCheck.ts'
import type { CrossCheck, UmlFlag } from './crossCheck.ts'
import { toMermaid } from './mermaid.ts'
import { MEMBER_NAME_RE } from './uml.ts'
import type { SolutionModel } from './solution-types.ts'
import { snapshotAt, timeline } from './timeline.ts'
import type { TimelineStep } from './timeline.ts'
import type { UmlChange, UmlElement, UmlKind, UmlModel, UmlRelKind } from './uml-types.ts'

export type Unplanned = 'components' | 'all' | 'none'
export type DiagramStatus = 'active' | 'removed' | 'abandoned'
export interface DiagramMember { text: string; kind: 'attribute' | 'operation'; removed: boolean; flag?: 'matching' | 'planned-not-built' }
export interface DiagramElement {
  id: string; name: string; kind: UmlKind; stereotype?: string; code?: string; note?: string
  /** attributes first, then operations, each in insertion order */
  members: DiagramMember[]
  /** abandoned = the last removal was an abandon cascade */
  status: DiagramStatus
  flag: UmlFlag | null; change: UmlChange | null; decisions: string[]; source: 'intended' | 'actual'
}
export interface DiagramRelation {
  id: string; from: string; to: string; kind: UmlRelKind; label?: string
  status: DiagramStatus; flag: UmlFlag | null; change: UmlChange | null; source: 'intended' | 'actual'
}
export type DiagramCounts = Record<UmlFlag, number> & { plannedMembers: number; relations: Record<UmlFlag, number> }
export interface Diagram {
  step: number; steps: number; current: TimelineStep | null
  decision?: { id: string; label: string; detail?: string; drivenBy: string[] }
  elements: DiagramElement[]; relations: DiagramRelation[]
  counts: DiagramCounts
  scan: { root: string; at: number | null; truncated: boolean } | null
  /** built-not-planned items left out at the latest step */
  hidden: number
}
export interface DiagramInput {
  uml: UmlModel; sol?: SolutionModel; actual?: ActualDesign | null; step?: number | null
  unplanned?: Unplanned; scannedAt?: number | null
}
export interface UmlMark { flag: UmlFlag | null; status: string; change: UmlChange | null }
export interface UmlVariant {
  mermaid: string; names: Record<string, string>; marks: Record<string, UmlMark>
  /** element id -> names of its planned-not-built members (absent when there are none) */
  pending?: Record<string, string[]>
}
export interface UmlPageStep extends UmlVariant {
  index: number; decision: string; label: string; abandoned: boolean; detail?: string; drivenBy: string[]
  changes: TimelineStep['changes']
}
export interface UmlPageData {
  steps: UmlPageStep[]
  latest: Record<Unplanned, UmlVariant>
  latestDiagram: Diagram
  counts: DiagramCounts
  scan: Diagram['scan']
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const zero = (): Record<UmlFlag, number> => Object.fromEntries(UML_FLAGS.map((f) => [f, 0])) as Record<UmlFlag, number>
const basename = (p: string): string => p.slice(p.lastIndexOf('/') + 1)

function membersOf(el: UmlElement, checked: Record<string, 'matching' | 'planned-not-built'> | undefined): DiagramMember[] {
  const out: DiagramMember[] = []
  for (const kind of ['attribute', 'operation'] as const) {
    for (const m of el.members) {
      if (m.kind !== kind) continue
      const dm: DiagramMember = { text: m.text, kind, removed: m.status === 'removed' }
      const f = m.status === 'active' ? checked?.[m.name] : undefined
      if (f) dm.flag = f
      out.push(dm)
    }
  }
  return out
}

export function buildDiagram(input: DiagramInput): Diagram {
  const { uml, sol } = input
  const steps = timeline(uml, sol)
  const n = steps.length
  const raw = input.step === null || input.step === undefined ? n : Number(input.step)
  const step = Math.max(0, Math.min(n, Math.floor(Number.isFinite(raw) ? raw : n)))
  const latest = step === n
  const current = step > 0 ? steps[step - 1]! : null
  const snap = snapshotAt(uml, step)
  const end = current ? current.to : 0

  // last removal per target, up to the step: cascade or not
  const lastRemoval = new Map<string, boolean>()
  for (let i = 0; i < end; i++) {
    const e = uml.log[i]!
    if (e.change === 'removed') lastRemoval.set(e.target, Boolean(e.cascade))
  }
  const statusOf = (id: string, s: 'active' | 'removed'): DiagramStatus => (s === 'active' ? 'active' : lastRemoval.get(id) ? 'abandoned' : 'removed')

  // change marks: element/relation targets directly; member targets mark their element 'changed'
  const change = new Map<string, UmlChange>()
  if (current) {
    for (const kind of ['added', 'changed', 'removed'] as const) for (const t of current.changes[kind]) if (snap.elements[t] || snap.relations[t]) change.set(t, kind)
    for (const kind of ['added', 'changed', 'removed'] as const) {
      for (const t of current.changes[kind]) {
        if (snap.elements[t] || snap.relations[t]) continue
        const dot = t.indexOf('.')
        const owner = dot >= 0 ? t.slice(0, dot) : t
        if (snap.elements[owner] && !change.has(owner)) change.set(owner, 'changed')
      }
    }
  }

  const actual = input.actual ?? null
  const cc: CrossCheck | null = actual ? crossCheck(snap, actual) : null
  const counts: DiagramCounts = { ...zero(), plannedMembers: 0, relations: zero() }

  const elements: DiagramElement[] = []
  const intended = Object.values(snap.elements).sort((a, b) => a.createdSeq - b.createdSeq || cmp(a.id, b.id))
  for (const el of intended) {
    const check = cc?.elements[el.id]
    const de: DiagramElement = {
      id: el.id, name: el.name, kind: el.kind, members: membersOf(el, check?.members),
      status: statusOf(el.id, el.status), flag: check?.flag ?? null, change: change.get(el.id) ?? null,
      decisions: [...el.decisions], source: 'intended',
    }
    if (el.stereotype) de.stereotype = el.stereotype
    if (el.code) de.code = el.code
    if (el.note) de.note = el.note
    if (de.flag) counts[de.flag]++
    if (el.status === 'active') counts.plannedMembers += de.members.filter((m) => m.flag === 'planned-not-built').length
    elements.push(de)
  }

  const relations: DiagramRelation[] = []
  const rels = Object.values(snap.relations).sort((a, b) => a.createdSeq - b.createdSeq || cmp(a.id, b.id))
  for (const r of rels) {
    let status = statusOf(r.id, r.status)
    if (status === 'active') {
      const ends = [snap.elements[r.from], snap.elements[r.to]].map((e) => (e ? statusOf(e.id, e.status) : 'removed'))
      if (ends.includes('abandoned')) status = 'abandoned'
      else if (ends.includes('removed')) status = 'removed'
    }
    const dr: DiagramRelation = { id: r.id, from: r.from, to: r.to, kind: r.kind, status, flag: cc?.relations[r.id] ?? null, change: change.get(r.id) ?? null, source: 'intended' }
    if (r.label) dr.label = r.label
    if (dr.flag) counts.relations[dr.flag]++
    relations.push(dr)
  }

  let hidden = 0
  if (cc && actual && latest) {
    const mode = input.unplanned ?? 'components'
    counts['built-not-planned'] = cc.unplanned.modules.length
    const extra: DiagramElement[] = []
    const showModules = mode !== 'none'
    const showTypes = mode === 'all'
    for (const p of cc.unplanned.modules) {
      if (!showModules) { hidden++; continue }
      const m = actual.modules[p]!
      const members: DiagramMember[] = [
        ...m.consts.map((c) => ({ text: c.text, kind: 'attribute' as const, removed: false })),
        ...m.functions.map((f) => ({ text: f.text, kind: 'operation' as const, removed: false })),
      ]
      extra.push({ id: `code:${p}`, name: basename(p), kind: 'component', code: p, members, status: 'active', flag: 'built-not-planned', change: null, decisions: [], source: 'actual' })
    }
    for (const tid of cc.unplanned.types) {
      if (!showTypes) { hidden++; continue }
      const t = actual.types[tid]!
      const members: DiagramMember[] = [
        ...t.attributes.map((c) => ({ text: c.text, kind: 'attribute' as const, removed: false })),
        ...t.operations.map((f) => ({ text: f.text, kind: 'operation' as const, removed: false })),
      ]
      const de: DiagramElement = { id: `code:${tid}`, name: t.name, kind: t.kind, code: tid, members, status: 'active', flag: 'built-not-planned', change: null, decisions: [], source: 'actual' }
      if (t.stereotype) de.stereotype = t.stereotype
      extra.push(de)
    }
    extra.sort((a, b) => cmp(a.id, b.id))
    elements.push(...extra)

    // unplanned dependencies between planned modules, drawn between the components that stand for them
    const moduleElement = new Map<string, string>()
    for (const el of intended) {
      const a = cc.elements[el.id]?.actual
      if (el.kind === 'component' && a && actual.modules[a] && !moduleElement.has(a)) moduleElement.set(a, el.id)
    }
    for (const r of cc.unplanned.relations) {
      const from = moduleElement.get(r.from)
      const to = moduleElement.get(r.to)
      if (mode === 'none' || !from || !to) { hidden++; continue }
      relations.push({ id: `${from}|dependency|${to}`, from, to, kind: 'dependency', status: 'active', flag: 'built-not-planned', change: null, source: 'actual' })
      counts.relations['built-not-planned']++
    }
  }

  const d: Diagram = {
    step, steps: n, current, elements, relations, counts,
    scan: actual ? { root: actual.root, at: input.scannedAt ?? null, truncated: actual.truncated } : null,
    hidden,
  }
  if (current) {
    const node = sol?.nodes[current.decision]
    const decision: NonNullable<Diagram['decision']> = { id: current.decision, label: node?.label ?? current.decision, drivenBy: [] }
    if (node?.detail) decision.detail = node.detail
    if (sol) {
      for (const e of sol.edges) {
        if (e.kind !== 'constrains' || e.to !== current.decision) continue
        const from = sol.nodes[e.from]
        if (from) decision.drivenBy.push(from.label)
      }
    }
    d.decision = decision
  }
  return d
}

/** the member's name, as uml.ts derives it */
const memberName = (text: string): string => MEMBER_NAME_RE.exec(text)?.[1] ?? text

function variant(d: Diagram): UmlVariant {
  const out = toMermaid(d)
  const marks: Record<string, UmlMark> = {}
  for (const e of d.elements) {
    const name = out.names[e.id]
    if (name) marks[name] = { flag: e.flag, status: e.status, change: e.change }
  }
  const v: UmlVariant = { mermaid: out.text, names: out.names, marks }
  const pending: Record<string, string[]> = {}
  for (const e of d.elements) {
    if (!out.names[e.id]) continue
    const names = e.members.filter((m) => m.flag === 'planned-not-built').map((m) => memberName(m.text))
    if (names.length) pending[e.id] = names
  }
  if (Object.keys(pending).length) v.pending = pending
  return v
}

/** Every step's Mermaid text (unplanned 'none' but at the latest step), plus the three latest variants. */
export function umlPageData(uml: UmlModel, sol: SolutionModel | undefined, actual: ActualDesign | null, opts: { scannedAt?: number | null; maxSteps?: number } = {}): UmlPageData {
  const steps = timeline(uml, sol)
  const n = steps.length
  const max = Math.max(1, Math.floor(opts.maxSteps ?? 60))
  const merged = n > max ? n - max + 1 : 0
  const base = { uml, sol, actual, scannedAt: opts.scannedAt ?? null }
  const out: UmlPageStep[] = []
  const first = merged ? merged : 1
  for (let k = first; k <= n; k++) {
    const d = buildDiagram({ ...base, step: k, unplanned: k === n ? 'components' : 'none' })
    const s = steps[k - 1]!
    let changes = s.changes
    let label = s.label
    if (k === merged) {
      label = `… ${merged} earlier decisions`
      const state = new Map<string, UmlChange>()
      for (let j = 0; j < merged; j++) {
        for (const kind of ['added', 'changed', 'removed'] as const) {
          for (const t of steps[j]!.changes[kind]) {
            const prev = state.get(t)
            if (kind === 'removed') state.set(t, 'removed')
            else if (prev === undefined) state.set(t, kind)
            else if (prev === 'removed') state.set(t, kind === 'added' ? 'added' : 'changed')
          }
        }
      }
      changes = { added: [], changed: [], removed: [] }
      for (const [t, c] of state) changes[c].push(t)
      for (const e of d.elements) e.change = state.get(e.id) ?? null
      for (const r of d.relations) r.change = state.get(r.id) ?? null
    }
    out.push({
      index: out.length + 1, decision: s.decision, label, abandoned: k === merged ? false : s.abandoned,
      ...(d.decision?.detail ? { detail: d.decision.detail } : {}), drivenBy: d.decision?.drivenBy ?? [],
      changes, ...variant(d),
    })
  }
  const latestDiagram = buildDiagram({ ...base, step: null, unplanned: 'components' })
  const latest: Record<Unplanned, UmlVariant> = {
    components: variant(latestDiagram),
    all: variant(buildDiagram({ ...base, step: null, unplanned: 'all' })),
    none: variant(buildDiagram({ ...base, step: null, unplanned: 'none' })),
  }
  return { steps: out, latest, latestDiagram, counts: latestDiagram.counts, scan: latestDiagram.scan }
}
