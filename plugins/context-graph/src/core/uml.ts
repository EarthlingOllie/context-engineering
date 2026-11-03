// The UML reducer and the design entry point (v3 design.md 4.1, deep module #10). Pure and total: never throws.
import type { SolStatus, SolutionModel, SolOp } from './solution-types.ts'
import type {
  DesignOp, DesignOpResult, DesignState, UmlChange, UmlElement, UmlKind, UmlLogEntry, UmlMember, UmlModel, UmlOp, UmlRelation, UmlRelKind,
} from './uml-types.ts'
import { UML_KINDS, UML_REL_KINDS } from './uml-types.ts'
import { applyOps, normaliseOp, slug, toSeed, SEED_FORMAT } from './solution.ts'

export const UML_CAPS = { elements: 300, relations: 1000, members: 24, log: 4000 } as const
export const DESIGN_SEED_FORMAT = 'context-graph/solution@2'
const NAME_MAX = 60
const MEMBER_MAX = 80
const STEREO_MAX = 40
const NOTE_MAX = 140
const CODE_MAX = 200
const LABEL_MAX = 40
const REASON_MAX = 140

export interface UmlCtx {
  decision: (id: string) => { status: SolStatus; label: string } | undefined
  solSeq: number
}

export function emptyUml(): UmlModel {
  return { version: 1, elements: {}, relations: {}, log: [], seq: 0 }
}

/**
 * Element name -> slug. camelCase is split only at a lower/digit -> upper boundary, so
 * "SvgRenderer" -> "svg-renderer" and "HTTPServer2" -> "httpserver2" (acronym runs stay whole). Never empty.
 */
export function umlSlug(name: string): string {
  return slug(String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
}

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s)
const isStr = (v: unknown): v is string => typeof v === 'string'
const optStr = (v: unknown) => v === undefined || isStr(v)
const strArr = (v: unknown) => v === undefined || (Array.isArray(v) && v.every(isStr))
const isUmlKind = (v: unknown): v is UmlKind => isStr(v) && (UML_KINDS as readonly string[]).includes(v)
const isRelKind = (v: unknown): v is UmlRelKind => isStr(v) && (UML_REL_KINDS as readonly string[]).includes(v)
const ID_RE = /^[a-z]+:[a-z0-9-]{1,48}$/
export const MEMBER_NAME_RE = /^\s*[+\-#~]?\s*([A-Za-z_$][\w$]*)/
const relId = (from: string, kind: UmlRelKind, to: string) => `${from}|${kind}|${to}`

function pick<T>(o: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

// ---------------------------------------------------------------------------------------------
// Op shape

/** Shape check for one op: v2 normaliseOp for solution ops, plus the uml.* ops. Returns a clean copy or null. */
export function normaliseDesignOp(raw: unknown): DesignOp | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (!isStr(o.op) || !o.op.startsWith('uml.')) return normaliseOp(raw)
  if (!isStr(o.decision) || !o.decision) return null
  switch (o.op) {
    case 'uml.add':
      if (!isUmlKind(o.kind) || !isStr(o.name) || !optStr(o.id) || !optStr(o.stereotype) || !optStr(o.in) || !optStr(o.code) || !optStr(o.note)) return null
      if (!strArr(o.attributes) || !strArr(o.operations)) return null
      return pick({
        op: 'uml.add', decision: o.decision, kind: o.kind, name: o.name, id: o.id, stereotype: o.stereotype, in: o.in, code: o.code, note: o.note,
        attributes: o.attributes, operations: o.operations,
      })
    case 'uml.relate':
      if (!isRelKind(o.kind) || !isStr(o.from) || !isStr(o.to) || !optStr(o.label)) return null
      return pick({ op: 'uml.relate', decision: o.decision, kind: o.kind, from: o.from, to: o.to, label: o.label })
    case 'uml.remove':
      if (!isStr(o.reason) || !optStr(o.id) || !optStr(o.member) || !optStr(o.from) || !optStr(o.to)) return null
      if (o.kind !== undefined && !isRelKind(o.kind)) return null
      if (o.cascade !== undefined && o.cascade !== true) return null
      return pick({ op: 'uml.remove', decision: o.decision, reason: o.reason, id: o.id, member: o.member, from: o.from, to: o.to, kind: o.kind, cascade: o.cascade })
    default:
      return null
  }
}

// ---------------------------------------------------------------------------------------------
// applyUmlOps

type Fail = { error: string }
/** A validated change: new objects to put and the log entries (one seq each) that describe them. */
type Plan = {
  id: string
  warnings: string[]
  elements: UmlElement[]
  relations: UmlRelation[]
  entries: { target: string; change: UmlChange; op: UmlOp }[]
}
type Work = { elements: Record<string, UmlElement>; relations: Record<string, UmlRelation>; seq: number; logLength: number }

const fail = (error: string): Fail => ({ error })

const RELATION_RULES: Record<UmlRelKind, { from: readonly UmlKind[]; to: readonly UmlKind[] | 'same'; self: boolean }> = {
  association: { from: ['component', 'class', 'interface'], to: ['component', 'class', 'interface'], self: true },
  dependency: { from: ['component', 'class', 'interface'], to: ['component', 'class', 'interface'], self: false },
  realization: { from: ['component', 'class'], to: ['interface'], self: false },
  composition: { from: ['component', 'class'], to: ['component', 'class', 'interface'], self: false },
  generalization: { from: ['class', 'interface'], to: 'same', self: false },
}

function relationAllowed(a: UmlElement, b: UmlElement, kind: UmlRelKind): boolean {
  const rule = RELATION_RULES[kind]
  if (a.id === b.id && !rule.self) return false
  if (!rule.from.includes(a.kind)) return false
  return rule.to === 'same' ? a.kind === b.kind : rule.to.includes(b.kind)
}

export function applyUmlOps(u: UmlModel, ops: UmlOp[], ctx: UmlCtx): { model: UmlModel; results: DesignOpResult[] } {
  const results: DesignOpResult[] = []
  const list: unknown[] = Array.isArray(ops) ? ops : []
  let w: Work | null = null
  let log: UmlLogEntry[] | null = null
  list.forEach((raw, i) => {
    const opName = raw && typeof raw === 'object' && isStr((raw as { op?: unknown }).op) ? ((raw as { op: string }).op as DesignOpResult['op']) : 'uml.add'
    const cur: Work = w ?? { elements: u.elements, relations: u.relations, seq: u.seq, logLength: u.log.length }
    let out: Plan | Fail
    let op: UmlOp | null = null
    try {
      const n = normaliseDesignOp(raw)
      op = n && n.op.startsWith('uml.') ? (n as UmlOp) : null
      out = op ? plan(cur, op, ctx) : fail('bad-op')
    } catch {
      out = fail('bad-op')
    }
    if ('error' in out) {
      results.push({ i, op: opName, ok: false, error: out.error })
      return
    }
    const r: DesignOpResult = { i, op: opName, ok: true, id: out.id }
    if (out.warnings.length) r.warnings = out.warnings
    if (out.entries.length) {
      if (!w) w = { elements: { ...u.elements }, relations: { ...u.relations }, seq: u.seq, logLength: u.log.length }
      if (!log) log = [...u.log]
      for (const el of out.elements) w.elements[el.id] = el
      for (const rel of out.relations) w.relations[rel.id] = rel
      for (const e of out.entries) {
        w.seq++
        const entry: UmlLogEntry = { seq: w.seq, solSeq: ctx.solSeq, decision: op!.decision, op: e.op, target: e.target, change: e.change }
        if (op!.op === 'uml.remove' && op!.cascade) entry.cascade = true
        log.push(entry)
      }
      w.logLength = log.length
      r.change = out.entries[0]!.change
    }
    results.push(r)
  })
  if (!w || !log) return { model: u, results }
  const done = w as Work
  return { model: { version: 1, elements: done.elements, relations: done.relations, log, seq: done.seq }, results }
}

/**
 * Replays already-applied ops into a private mutable work state (records mutated in place; element and
 * relation objects are replaced, never mutated). Every decision is accepted and no log is kept. For timeline snapshots.
 */
export function replayInto(w: { elements: Record<string, UmlElement>; relations: Record<string, UmlRelation>; seq: number }, ops: UmlOp[]): void {
  const work: Work = { elements: w.elements, relations: w.relations, seq: w.seq, logLength: 0 }
  for (const op of ops) {
    let out: Plan | Fail
    try {
      out = plan(work, op, REPLAY_CTX)
    } catch {
      continue
    }
    if ('error' in out) continue
    for (const el of out.elements) work.elements[el.id] = el
    for (const rel of out.relations) work.relations[rel.id] = rel
    work.seq += out.entries.length
  }
  w.seq = work.seq
}
const REPLAY_CTX: UmlCtx = { decision: () => ({ status: 'active', label: '' }), solSeq: 0 }

function plan(w: Work, op: UmlOp, ctx: UmlCtx): Plan | Fail {
  const warnings: string[] = []
  const d = ctx.decision(op.decision)
  if (!d) return fail('unknown-decision')
  if (d.status === 'abandoned') warnings.push('decision-abandoned')
  switch (op.op) {
    case 'uml.add':
      return planAdd(w, op, warnings)
    case 'uml.relate':
      return planRelate(w, op, warnings)
    case 'uml.remove':
      return planRemove(w, op, warnings)
  }
}

const withDecision = (list: string[], d: string) => (list.includes(d) ? list : [...list, d])

function parseMembers(texts: string[] | undefined, kind: UmlMember['kind'], decision: string): UmlMember[] | Fail {
  const out: UmlMember[] = []
  for (const raw of texts ?? []) {
    const text = cut(raw.replace(/\s+/g, ' ').trim(), MEMBER_MAX)
    const m = MEMBER_NAME_RE.exec(text)
    if (!m) return fail('bad-op')
    out.push({ name: m[1]!, text, kind, status: 'active', decision })
  }
  return out
}

function planAdd(w: Work, op: Extract<UmlOp, { op: 'uml.add' }>, warnings: string[]): Plan | Fail {
  const name = cut(op.name.trim(), NAME_MAX)
  if (!name) return fail('bad-op')
  if (op.id !== undefined && !ID_RE.test(op.id)) return fail('bad-op')
  if (op.in !== undefined && !ID_RE.test(op.in)) return fail('bad-op')
  const id = op.id ?? `uml:${umlSlug(name)}`
  const attrs = parseMembers(op.attributes, 'attribute', op.decision)
  if ('error' in attrs) return attrs
  const opers = parseMembers(op.operations, 'operation', op.decision)
  if ('error' in opers) return opers
  const prev = w.elements[id]
  if (prev && prev.kind !== op.kind) return fail('kind-mismatch')
  if (!prev && Object.keys(w.elements).length >= UML_CAPS.elements) return fail('cap')
  if (op.in !== undefined) {
    const owner = w.elements[op.in]
    if (!owner || owner.kind !== 'component' || op.in === id) return fail('bad-relation')
    if (!w.relations[relId(op.in, 'composition', id)] && Object.keys(w.relations).length >= UML_CAPS.relations) return fail('cap')
  }

  // Merge members by (kind, name); a new text replaces the old one and revives a removed member.
  const members = prev ? prev.members.map((m) => ({ ...m })) : []
  let membersChanged = false
  for (const m of [...attrs, ...opers]) {
    const at = members.findIndex((x) => x.kind === m.kind && x.name === m.name)
    if (at < 0) {
      members.push(m)
      membersChanged = true
    } else {
      const old = members[at]!
      if (old.text !== m.text || old.status !== 'active') {
        members[at] = m
        membersChanged = true
      }
    }
  }
  if (members.length > UML_CAPS.members) return fail('cap')

  const seq = w.seq + 1
  const el: UmlElement = prev
    ? { ...prev, members, decisions: withDecision(prev.decisions, op.decision) }
    : { id, kind: op.kind, name, members, status: 'active', decisions: [op.decision], createdSeq: seq, updatedSeq: seq }
  if (prev) el.name = name
  if (op.stereotype !== undefined) el.stereotype = cut(op.stereotype.trim(), STEREO_MAX)
  if (op.code !== undefined) el.code = cut(op.code.trim(), CODE_MAX)
  if (op.note !== undefined) el.note = cut(op.note.trim(), NOTE_MAX)
  if (op.in !== undefined) el.owner = op.in
  if (prev?.status === 'removed') {
    el.status = 'active'
    delete el.reason
    warnings.push('revived')
  }
  const elChanged = !prev || membersChanged || el.status !== prev.status || el.name !== prev.name || el.stereotype !== prev.stereotype ||
    el.code !== prev.code || el.note !== prev.note || el.owner !== prev.owner || el.decisions.length !== prev.decisions.length

  const p: Plan = { id, warnings, elements: [], relations: [], entries: [] }
  if (elChanged) {
    el.updatedSeq = seq
    p.elements.push(el)
    p.entries.push({ target: id, change: prev ? 'changed' : 'added', op })
  }
  if (op.in !== undefined) {
    const rel = upsertRelation(w, op.in, 'composition', id, undefined, op.decision, seq + p.entries.length)
    if (rel) {
      p.relations.push(rel.rel)
      p.entries.push({ target: rel.rel.id, change: rel.change, op: { op: 'uml.relate', decision: op.decision, kind: 'composition', from: op.in, to: id } })
    }
  }
  if (!p.entries.length) {
    warnings.push('duplicate')
    return p
  }
  if (w.logLength + p.entries.length > UML_CAPS.log) return fail('cap')
  return p
}

/** The relation after an upsert, or null when nothing changes. */
function upsertRelation(w: Work, from: string, kind: UmlRelKind, to: string, label: string | undefined, decision: string, seq: number):
  { rel: UmlRelation; change: UmlChange } | null {
  const id = relId(from, kind, to)
  const prev = w.relations[id]
  if (!prev) {
    const rel: UmlRelation = { id, from, to, kind, status: 'active', decisions: [decision], createdSeq: seq, updatedSeq: seq }
    if (label) rel.label = label
    return { rel, change: 'added' }
  }
  const rel: UmlRelation = { ...prev, decisions: withDecision(prev.decisions, decision), status: 'active', updatedSeq: seq }
  delete rel.reason
  if (label !== undefined) {
    if (label) rel.label = label
    else delete rel.label
  }
  const same = prev.status === 'active' && rel.label === prev.label && rel.decisions.length === prev.decisions.length
  return same ? null : { rel, change: 'changed' }
}

function planRelate(w: Work, op: Extract<UmlOp, { op: 'uml.relate' }>, warnings: string[]): Plan | Fail {
  const a = w.elements[op.from]
  const b = w.elements[op.to]
  if (!a || !b) return fail('unknown-id')
  if (!relationAllowed(a, b, op.kind)) return fail('bad-relation')
  const id = relId(op.from, op.kind, op.to)
  const prev = w.relations[id]
  if (!prev && Object.keys(w.relations).length >= UML_CAPS.relations) return fail('cap')
  const label = op.label === undefined ? undefined : cut(op.label.replace(/\s+/g, ' ').trim(), LABEL_MAX)
  const up = upsertRelation(w, op.from, op.kind, op.to, label, op.decision, w.seq + 1)
  const p: Plan = { id, warnings, elements: [], relations: [], entries: [] }
  if (!up) {
    warnings.push('duplicate')
    return p
  }
  if (prev?.status === 'removed') warnings.push('revived')
  if (w.logLength + 1 > UML_CAPS.log) return fail('cap')
  p.relations.push(up.rel)
  p.entries.push({ target: id, change: up.change, op })
  return p
}

function planRemove(w: Work, op: Extract<UmlOp, { op: 'uml.remove' }>, warnings: string[]): Plan | Fail {
  const reason = cut(op.reason.trim(), REASON_MAX)
  if (!reason) return fail('reason-required')
  const byId = op.id !== undefined
  const byRel = op.from !== undefined || op.to !== undefined || op.kind !== undefined
  if (byId === byRel) return fail('bad-op')
  if (byRel && (op.from === undefined || op.to === undefined || op.kind === undefined)) return fail('bad-op')
  if (op.member !== undefined && !byId) return fail('bad-op')
  const seq = w.seq + 1
  const p: Plan = { id: '', warnings, elements: [], relations: [], entries: [] }
  if (byRel) {
    const id = relId(op.from!, op.kind!, op.to!)
    p.id = id
    const prev = w.relations[id]
    if (!prev) return fail('unknown-id')
    if (prev.status === 'removed') {
      warnings.push('already-removed')
      return p
    }
    p.relations.push({ ...prev, status: 'removed', reason, decisions: withDecision(prev.decisions, op.decision), updatedSeq: seq })
    p.entries.push({ target: id, change: 'removed', op })
  } else {
    const prev = w.elements[op.id!]
    p.id = op.id!
    if (!prev) return fail('unknown-id')
    if (op.member !== undefined) {
      const at = prev.members.findIndex((m) => m.name === op.member)
      if (at < 0) return fail('unknown-member')
      if (prev.members[at]!.status === 'removed') {
        warnings.push('already-removed')
        return p
      }
      const members = prev.members.map((m, k) => (k === at ? { ...m, status: 'removed' as const, decision: op.decision } : m))
      p.elements.push({ ...prev, members, decisions: withDecision(prev.decisions, op.decision), updatedSeq: seq })
      p.entries.push({ target: `${prev.id}.${op.member}`, change: 'removed', op })
    } else {
      if (prev.status === 'removed') {
        warnings.push('already-removed')
        return p
      }
      p.elements.push({ ...prev, status: 'removed', reason, decisions: withDecision(prev.decisions, op.decision), updatedSeq: seq })
      p.entries.push({ target: prev.id, change: 'removed', op })
    }
  }
  if (w.logLength + 1 > UML_CAPS.log) return fail('cap')
  return p
}

// ---------------------------------------------------------------------------------------------
// Abandon cascade and the design entry point

/**
 * Removes every active element, relation and member that only abandoned decisions touched, `decision` among them.
 * `isAbandoned` defaults to "is `decision`". Entries are logged as uml.remove with cascade:true.
 */
export function cascadeAbandon(u: UmlModel, decision: string, reason: string, solSeq: number, isAbandoned: (id: string) => boolean = (id) => id === decision): UmlModel {
  const onlyAbandoned = (ds: string[]) => ds.includes(decision) && ds.every((d) => d === decision || isAbandoned(d))
  const why = cut(String(reason).trim(), REASON_MAX) || 'abandoned'
  const ops: UmlOp[] = []
  const elements = Object.values(u.elements).sort((a, b) => a.createdSeq - b.createdSeq || (a.id < b.id ? -1 : 1))
  const goneEls = new Set<string>()
  for (const el of elements) {
    if (el.status === 'active' && onlyAbandoned(el.decisions)) {
      goneEls.add(el.id)
      ops.push({ op: 'uml.remove', decision, reason: why, id: el.id, cascade: true })
    }
  }
  for (const el of elements) {
    if (el.status !== 'active' || goneEls.has(el.id)) continue
    for (const m of el.members) {
      if (m.status === 'active' && m.decision === decision) ops.push({ op: 'uml.remove', decision, reason: why, id: el.id, member: m.name, cascade: true })
    }
  }
  const rels = Object.values(u.relations).sort((a, b) => a.createdSeq - b.createdSeq || (a.id < b.id ? -1 : 1))
  for (const r of rels) {
    if (r.status === 'active' && onlyAbandoned(r.decisions)) ops.push({ op: 'uml.remove', decision, reason: why, from: r.from, kind: r.kind, to: r.to, cascade: true })
  }
  if (!ops.length) return u
  return applyUmlOps(u, ops, { decision: (id) => (id === decision ? { status: 'abandoned', label: id } : undefined), solSeq }).model
}

/** The only entry point the shell and the scripts use: solution ops to v2 applyOps, uml.* ops to applyUmlOps, abandon cascades. */
export function applyDesignOps(s: DesignState, ops: DesignOp[], ctx: { isEvidence?: (id: string) => boolean } = {}): { state: DesignState; results: DesignOpResult[] } {
  const results: DesignOpResult[] = []
  let sol = s.sol
  let uml = s.uml
  const list: unknown[] = Array.isArray(ops) ? ops : []
  list.forEach((raw, i) => {
    const name = raw && typeof raw === 'object' && isStr((raw as { op?: unknown }).op) ? (raw as { op: string }).op : ''
    if (name.startsWith('uml.')) {
      const cur = sol
      const umlCtx: UmlCtx = {
        decision: (id) => {
          const n = cur.nodes[id]
          return n && n.kind === 'decision' ? { status: n.status, label: n.label } : undefined
        },
        solSeq: cur.seq,
      }
      const out = applyUmlOps(uml, [raw as UmlOp], umlCtx)
      uml = out.model
      results.push({ ...out.results[0]!, i })
      return
    }
    const out = applyOps(sol, [raw as SolOp], ctx)
    sol = out.model
    const r = out.results[0]!
    results.push({ ...r, i })
    if (r.ok && r.op === 'abandon') {
      const id = (raw as { id: string }).id
      const node = sol.nodes[id]
      if (node?.kind === 'decision') {
        const before = uml.log.length
        const cur = sol
        uml = cascadeAbandon(uml, id, node.reason ?? 'abandoned', sol.seq, (d) => cur.nodes[d]?.status === 'abandoned')
        const cascaded = uml.log.slice(before).map((e) => e.target)
        if (cascaded.length) results.push({ i, op: 'uml.cascade', ok: true, cascaded })
      }
    }
  })
  if (sol === s.sol && uml === s.uml) return { state: s, results }
  return { state: { sol, uml }, results }
}

// ---------------------------------------------------------------------------------------------
// Seed @2

/** Seed file (@1 or @2) -> design ops. Never throws. */
export function parseDesignSeed(json: string): { title?: string; ops: DesignOp[]; errors: string[] } {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (e) {
    return { ops: [], errors: [`json: ${e instanceof Error ? e.message : String(e)}`] }
  }
  const expected = `"${SEED_FORMAT}" or "${DESIGN_SEED_FORMAT}"`
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ops: [], errors: [`format: expected an object with format ${expected}`] }
  const d = data as Record<string, unknown>
  if (d.format !== SEED_FORMAT && d.format !== DESIGN_SEED_FORMAT) return { ops: [], errors: [`format: expected ${expected}, got ${JSON.stringify(d.format ?? null)}`] }
  const v1 = d.format === SEED_FORMAT
  const out: { title?: string; ops: DesignOp[]; errors: string[] } = { ops: [], errors: [] }
  if (isStr(d.title)) out.title = d.title
  if (!Array.isArray(d.ops)) {
    out.errors.push('ops: expected an array')
    return out
  }
  d.ops.forEach((raw, i) => {
    const op = v1 ? normaliseOp(raw) : normaliseDesignOp(raw)
    if (op) out.ops.push(op)
    else out.errors.push(`ops[${i}]: malformed ${JSON.stringify(raw)?.slice(0, 80)}`)
  })
  return out
}

/** Models -> seed @2: v2 toSeed order for the solution, then the UML log replayed as ops (cascades explicit, flagged cascade:true). */
export function toDesignSeed(sol: SolutionModel, uml: UmlModel): string {
  const v1 = JSON.parse(toSeed(sol)) as { title?: string; ops: SolOp[] }
  const ops: DesignOp[] = [...v1.ops]
  for (const e of uml.log) ops.push(e.cascade && e.op.op === 'uml.remove' ? { ...e.op, cascade: true } : e.op)
  return JSON.stringify(pick({ format: DESIGN_SEED_FORMAT, title: sol.title, ops }), null, 2) + '\n'
}
