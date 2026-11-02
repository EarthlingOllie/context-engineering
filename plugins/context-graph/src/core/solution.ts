// The solution-model reducer (v2 design.md 4.1, deep module #6). Pure and total: never throws.
import type { OpResult, SolEdge, SolEdgeKind, SolKind, SolNode, SolOp, SolutionModel } from './solution-types.ts'
import { SOL_EDGE_KINDS, SOL_KINDS } from './solution-types.ts'

export const CAPS = { nodes: 200, edges: 800, supportPerNode: 12 } as const
const LABEL_MAX = 60
const DETAIL_MAX = 280
const REASON_MAX = 140

export function emptyModel(): SolutionModel {
  return { version: 1, goalId: null, nodes: {}, edges: [], seq: 0, promptSeq: 0 }
}

/** label -> [a-z0-9-]{1,48}; never empty. */
export function slug(label: string): string {
  const s = String(label)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return s || 'node'
}

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isKind = (v: unknown): v is SolKind => isStr(v) && (SOL_KINDS as readonly string[]).includes(v)
const isEdgeKind = (v: unknown): v is SolEdgeKind => isStr(v) && (SOL_EDGE_KINDS as readonly string[]).includes(v)
const ID_RE = /^[a-z]+:[a-z0-9-]{1,48}$/

/** Solution ids use a solution-kind prefix; evidence ids (prompt:, turn:, tool:, file:, ...) never do. */
const isSolutionId = (m: SolutionModel, id: string) => Boolean(m.nodes[id]) || isKind(id.slice(0, id.indexOf(':')))

// design.md section 3 "Link rules"; contradicts and supported-by are handled in link().
const LINK_RULES: Record<'depends-on' | 'constrains' | 'decided-by', { from: readonly SolKind[]; to: readonly SolKind[] }> = {
  'depends-on': { from: ['goal', 'component', 'decision'], to: ['component', 'dependency', 'decision', 'question'] },
  constrains: { from: ['requirement', 'constraint', 'assumption', 'dependency', 'risk', 'question'], to: ['goal', 'component', 'decision'] },
  'decided-by': { from: ['goal', 'component', 'question', 'risk'], to: ['decision'] },
}

type Fail = { error: string }
type Step = { model: SolutionModel; id?: string; warnings?: string[] }
type Ctx = { isEvidence?: (id: string) => boolean }

function fail(error: string): Fail {
  return { error }
}

export function applyOps(m: SolutionModel, ops: SolOp[], ctx: Ctx = {}): { model: SolutionModel; results: OpResult[] } {
  const results: OpResult[] = []
  let cur = m
  let any = false
  const list: unknown[] = Array.isArray(ops) ? ops : []
  list.forEach((raw, i) => {
    const opName = raw && typeof raw === 'object' && isStr((raw as { op?: unknown }).op) ? ((raw as { op: string }).op as SolOp['op']) : ('add' as const)
    let out: Step | Fail
    try {
      out = applyOne(cur, raw, ctx)
    } catch {
      out = fail('bad-op')
    }
    if ('error' in out) {
      results.push({ i, op: opName, ok: false, error: out.error })
      return
    }
    cur = out.model
    any = true
    const r: OpResult = { i, op: opName, ok: true }
    if (out.id) r.id = out.id
    if (out.warnings?.length) r.warnings = out.warnings
    results.push(r)
  })
  return { model: any ? cur : m, results }
}

function applyOne(m: SolutionModel, raw: unknown, ctx: Ctx): Step | Fail {
  if (!raw || typeof raw !== 'object') return fail('bad-op')
  const o = raw as Record<string, unknown>
  switch (o.op) {
    case 'add':
      return add(m, o, ctx)
    case 'link':
      return link(m, o, ctx)
    case 'resolve':
      return resolve(m, o, ctx)
    case 'abandon':
      return abandon(m, o)
    default:
      return fail('bad-op')
  }
}

/** A fresh model one seq ahead, with copied nodes/edges ready to mutate. */
function next(m: SolutionModel): SolutionModel {
  return { ...m, nodes: { ...m.nodes }, edges: [...m.edges], seq: m.seq + 1 }
}

function evidenceList(v: unknown): string[] | Fail {
  if (v === undefined) return []
  if (!Array.isArray(v) || !v.every((e) => isStr(e) && e.length > 0)) return fail('bad-op')
  return v as string[]
}

/** Adds supported-by edges in place on `m` (already a fresh copy). */
function addSupport(m: SolutionModel, from: string, evidence: string[], ctx: Ctx, warnings: string[]): Fail | null {
  for (const to of evidence) {
    if (isSolutionId(m, to)) return fail('bad-link')
    if (m.edges.some((e) => e.from === from && e.to === to && e.kind === 'supported-by')) {
      warnings.push('duplicate')
      continue
    }
    if (m.edges.length >= CAPS.edges) return fail('cap')
    if (m.edges.filter((e) => e.from === from && e.kind === 'supported-by').length >= CAPS.supportPerNode) return fail('cap')
    m.edges.push({ from, to, kind: 'supported-by', seq: m.seq })
    if (ctx.isEvidence && !ctx.isEvidence(to)) warnings.push(`dangling:${to}`)
  }
  return null
}

function add(m: SolutionModel, o: Record<string, unknown>, ctx: Ctx): Step | Fail {
  if (!isKind(o.kind) || !isStr(o.label)) return fail('bad-op')
  const label = cut(o.label.trim(), LABEL_MAX)
  if (!label) return fail('bad-op')
  if (o.detail !== undefined && !isStr(o.detail)) return fail('bad-op')
  if (o.id !== undefined && !(isStr(o.id) && ID_RE.test(o.id))) return fail('bad-op')
  const evidence = evidenceList(o.evidence)
  if ('error' in evidence) return evidence
  const kind = o.kind
  const id = isStr(o.id) ? o.id : `${kind}:${slug(label)}`
  const prev = m.nodes[id]
  if (prev && prev.kind !== kind) return fail('kind-mismatch')
  if (kind === 'goal' && m.goalId && m.goalId !== id) return fail('goal-exists')
  if (!prev && Object.keys(m.nodes).length >= CAPS.nodes) return fail('cap')
  const n = next(m)
  const warnings: string[] = []
  const node: SolNode = prev
    ? { ...prev, label, updatedSeq: n.seq }
    : { id, kind, label, status: kind === 'question' || kind === 'risk' ? 'open' : 'active', createdSeq: n.seq, updatedSeq: n.seq }
  if (isStr(o.detail)) node.detail = cut(o.detail.trim(), DETAIL_MAX)
  if (prev?.status === 'abandoned') warnings.push('still-abandoned')
  n.nodes[id] = node
  if (kind === 'goal') n.goalId = id
  const err = addSupport(n, id, evidence, ctx, warnings)
  if (err) return err
  return { model: n, id, warnings }
}


/** Validates one non-supported-by edge against the link table; returns the normalised edge ends. */
function checkLink(m: SolutionModel, from: string, to: string, kind: Exclude<SolEdgeKind, 'supported-by'>): { from: string; to: string } | Fail {
  const a = m.nodes[from]
  const b = m.nodes[to]
  if (!a || !b) return fail('unknown-id')
  if (kind === 'contradicts') {
    if (from === to) return fail('bad-link')
    return from < to ? { from, to } : { from: to, to: from }
  }
  const rule = LINK_RULES[kind]
  if (!rule.from.includes(a.kind) || !rule.to.includes(b.kind)) return fail('bad-link')
  return { from, to }
}

/** Pushes a solution edge onto a fresh copy `n`; duplicate -> warning, caps -> error. */
function pushEdge(n: SolutionModel, e: Omit<SolEdge, 'seq'>, warnings: string[]): Fail | null {
  if (n.edges.some((x) => x.from === e.from && x.to === e.to && x.kind === e.kind)) {
    warnings.push('duplicate')
    return null
  }
  if (n.edges.length >= CAPS.edges) return fail('cap')
  n.edges.push({ ...e, seq: n.seq })
  return null
}

function link(m: SolutionModel, o: Record<string, unknown>, ctx: Ctx): Step | Fail {
  if (!isStr(o.from) || !isStr(o.to) || !isEdgeKind(o.kind) || !o.from || !o.to) return fail('bad-op')
  const warnings: string[] = []
  if (o.kind === 'supported-by') {
    if (!m.nodes[o.from]) return fail('unknown-id')
    const n = next(m)
    const err = addSupport(n, o.from, [o.to], ctx, warnings)
    if (err) return err
    return { model: n, id: o.from, warnings }
  }
  const ends = checkLink(m, o.from, o.to, o.kind)
  if ('error' in ends) return ends
  const n = next(m)
  const err = pushEdge(n, { ...ends, kind: o.kind }, warnings)
  if (err) return err
  return { model: n, id: ends.from, warnings }
}

function resolve(m: SolutionModel, o: Record<string, unknown>, ctx: Ctx): Step | Fail {
  if (!isStr(o.id) || (o.by !== undefined && !isStr(o.by)) || (o.note !== undefined && !isStr(o.note))) return fail('bad-op')
  const evidence = evidenceList(o.evidence)
  if ('error' in evidence) return evidence
  const node = m.nodes[o.id]
  if (!node) return fail('unknown-id')
  if ((node.kind !== 'question' && node.kind !== 'risk') || node.status === 'abandoned' || node.status === 'active') return fail('not-resolvable')
  const warnings: string[] = []
  if (node.status === 'resolved') warnings.push('already-resolved')
  const n = next(m)
  if (isStr(o.by)) {
    const ends = checkLink(m, o.id, o.by, 'decided-by')
    if ('error' in ends) return ends
    const err = pushEdge(n, { ...ends, kind: 'decided-by' }, [])
    if (err) return err
  }
  const updated: SolNode = { ...node, status: 'resolved', updatedSeq: n.seq }
  if (isStr(o.note) && o.note.trim()) updated.reason = cut(o.note.trim(), REASON_MAX)
  n.nodes[o.id] = updated
  const err = addSupport(n, o.id, evidence, ctx, warnings)
  if (err) return err
  return { model: n, id: o.id, warnings }
}

function abandon(m: SolutionModel, o: Record<string, unknown>): Step | Fail {
  if (!isStr(o.id)) return fail('bad-op')
  const node = m.nodes[o.id]
  if (!node) return fail('unknown-id')
  if (node.kind === 'goal') return fail('goal-not-abandonable')
  if (!isStr(o.reason) || !o.reason.trim()) return fail('reason-required')
  const n = next(m)
  n.nodes[o.id] = { ...node, status: 'abandoned', reason: cut(o.reason.trim(), REASON_MAX), updatedSeq: n.seq }
  return { model: n, id: o.id }
}

export const SEED_FORMAT = 'context-graph/solution@1'

const strArr = (v: unknown) => v === undefined || (Array.isArray(v) && v.every(isStr))
const optStr = (v: unknown) => v === undefined || isStr(v)

/** Shape check for one op (no model checks). Returns a clean copy or null. */
export function normaliseOp(raw: unknown): SolOp | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  switch (o.op) {
    case 'add':
      if (!isKind(o.kind) || !isStr(o.label) || !optStr(o.id) || !optStr(o.detail) || !strArr(o.evidence)) return null
      return pick({ op: 'add', kind: o.kind, label: o.label, id: o.id, detail: o.detail, evidence: o.evidence }) as SolOp
    case 'link':
      if (!isStr(o.from) || !isStr(o.to) || !isEdgeKind(o.kind)) return null
      return { op: 'link', from: o.from, to: o.to, kind: o.kind }
    case 'resolve':
      if (!isStr(o.id) || !optStr(o.by) || !optStr(o.note) || !strArr(o.evidence)) return null
      return pick({ op: 'resolve', id: o.id, by: o.by, note: o.note, evidence: o.evidence }) as SolOp
    case 'abandon':
      if (!isStr(o.id) || !isStr(o.reason)) return null
      return { op: 'abandon', id: o.id, reason: o.reason }
    default:
      return null
  }
}

function pick(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

/** Seed file -> ops. Never throws. */
export function parseSeed(json: string): { title?: string; ops: SolOp[]; errors: string[] } {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (e) {
    return { ops: [], errors: [`json: ${e instanceof Error ? e.message : String(e)}`] }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ops: [], errors: [`format: expected an object with format "${SEED_FORMAT}"`] }
  const d = data as Record<string, unknown>
  if (d.format !== SEED_FORMAT) return { ops: [], errors: [`format: expected "${SEED_FORMAT}", got ${JSON.stringify(d.format ?? null)}`] }
  const out: { title?: string; ops: SolOp[]; errors: string[] } = { ops: [], errors: [] }
  if (isStr(d.title)) out.title = d.title
  if (!Array.isArray(d.ops)) {
    out.errors.push('ops: expected an array')
    return out
  }
  d.ops.forEach((raw, i) => {
    const op = normaliseOp(raw)
    if (op) out.ops.push(op)
    else out.errors.push(`ops[${i}]: malformed ${JSON.stringify(raw)?.slice(0, 80)}`)
  })
  return out
}

/** Model -> seed JSON: goal, other adds by createdSeq, links, resolves, abandons. */
export function toSeed(m: SolutionModel): string {
  const nodes = Object.values(m.nodes).sort((a, b) => a.createdSeq - b.createdSeq || (a.id < b.id ? -1 : 1))
  const ordered = [...nodes.filter((n) => n.id === m.goalId), ...nodes.filter((n) => n.id !== m.goalId)]
  const ops: SolOp[] = []
  for (const n of ordered) {
    const evidence = m.edges.filter((e) => e.from === n.id && e.kind === 'supported-by').map((e) => e.to)
    ops.push(pick({ op: 'add', kind: n.kind, id: n.id, label: n.label, detail: n.detail, evidence: evidence.length ? evidence : undefined }) as SolOp)
  }
  for (const e of m.edges) if (e.kind !== 'supported-by') ops.push({ op: 'link', from: e.from, to: e.to, kind: e.kind })
  for (const n of ordered) if (n.status === 'resolved') ops.push(pick({ op: 'resolve', id: n.id, note: n.reason }) as SolOp)
  for (const n of ordered) if (n.status === 'abandoned') ops.push({ op: 'abandon', id: n.id, reason: n.reason ?? 'abandoned' })
  return JSON.stringify(pick({ format: SEED_FORMAT, title: m.title, ops }), null, 2) + '\n'
}
