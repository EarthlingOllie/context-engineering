// context_graph tool input -> DesignOp list (v2 design.md 5.4, v3 design.md 4.9). Pure; the shell does the I/O.
import type { SolOp } from './solution-types.ts'
import type { DesignOp } from './uml-types.ts'
import { SOL_EDGE_KINDS, SOL_KINDS } from './solution-types.ts'
import { UML_KINDS, UML_REL_KINDS } from './uml-types.ts'
import { normaliseOp } from './solution.ts'
import { normaliseDesignOp } from './uml.ts'

export const TOOL_ACTIONS = ['inspect', 'focus', 'clear', 'add', 'link', 'resolve', 'abandon', 'import', 'uml.add', 'uml.relate', 'uml.remove', 'uml.scan'] as const
export type ToolAction = (typeof TOOL_ACTIONS)[number]
const ID_PATTERN = '^[a-z]+:[a-z0-9-]{1,48}$'
const ID_RE = new RegExp(ID_PATTERN)
const DECISION_PATTERN = '^decision:[a-z0-9-]{1,48}$'
const DECISION_RE = new RegExp(DECISION_PATTERN)
/** kind enum: solution node kinds, edge kinds, then the UML kinds not already in them (20 in all). */
const KIND_ENUM = [...new Set([...SOL_KINDS, ...SOL_EDGE_KINDS, ...UML_KINDS, ...UML_REL_KINDS])]

export const TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: {
      type: 'string',
      enum: TOOL_ACTIONS,
      description:
        'inspect: solution + UML model, cross-check and what the question touches; focus/clear: steer relevance; add/link/resolve/abandon: author the solution model; uml.add/uml.relate/uml.remove: record the intended UML design, each citing the decision that causes it; uml.scan: rescan the code (optionally set root); import: seed file or inline ops.',
    },
    kind: {
      type: 'string',
      enum: KIND_ENUM,
      description:
        'add: node kind. link: edge kind. uml.add: component | class | interface. uml.relate / uml.remove (relation): association | dependency | realization | composition | generalization.',
    },
    id: { type: 'string', pattern: ID_PATTERN, description: 'add/resolve/abandon: solution node id. uml.add (optional, default uml:<slug(name)>) / uml.remove: UML element id.' },
    label: { type: 'string', maxLength: 120, description: 'add: short name, cut to 60 chars. uml.relate: edge label, cut to 40.' },
    detail: { type: 'string', maxLength: 280, description: 'add: one or two sentences.' },
    evidence: { type: 'array', items: { type: 'string' }, maxItems: 12, description: 'add/resolve: transcript node ids (prompt:…, turn:…, tool:…, file:…) that support this; inspect lists them.' },
    from: { type: 'string', description: 'link: source solution id. uml.relate / uml.remove (relation): source UML element id.' },
    to: { type: 'string', description: 'link: target solution id, or an evidence id for supported-by. uml.relate / uml.remove (relation): target UML element id.' },
    by: { type: 'string', description: 'resolve: the decision id that settles the question or risk (adds decided-by).' },
    note: { type: 'string', maxLength: 140, description: 'resolve: how it was settled. focus: why these nodes matter. uml.add: tooltip note.' },
    reason: { type: 'string', maxLength: 140, description: 'abandon / uml.remove: why (required).' },
    path: { type: 'string', description: 'import: a seed file (context-graph/solution@1 or @2 JSON), relative to cwd or absolute.' },
    ops: { type: 'array', items: { type: 'object' }, maxItems: 200, description: "import: inline ops (solution and uml.* ops), same shape as a seed file's ops." },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'import: merge into the current models (default) or replace both.' },
    nodeIds: { type: 'array', items: { type: 'string' }, description: 'focus: solution, UML or transcript node ids.' },
    match: { type: 'string', description: 'focus: text matched against node labels, solution labels, UML names and file paths.' },
    decision: { type: 'string', pattern: DECISION_PATTERN, description: 'uml.add/uml.relate/uml.remove: the solution decision that causes this change (required; add the decision first).' },
    name: { type: 'string', minLength: 1, maxLength: 60, description: 'uml.add: element name as drawn, e.g. SvgRenderer.' },
    stereotype: { type: 'string', maxLength: 40, description: "uml.add: extra «stereotype», e.g. 'vendored' or 'MCP tool'." },
    attributes: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 24, description: "uml.add: attributes, e.g. 'theme: dark or light'. Merged by name." },
    operations: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 24, description: "uml.add: operations, e.g. '+renderSvg(scene, o) string'. Merged by name." },
    in: { type: 'string', pattern: ID_PATTERN, description: 'uml.add: owning component id (adds a composition).' },
    code: {
      type: 'string',
      maxLength: 200,
      description:
        "uml.add: where it lives, relative to the scan root: 'core/svg.ts', 'core/svg.ts#SvgOptions', a folder 'core/', '../outside/path', 'npm:pkg', or 'none' (not checkable). Omit to match by name.",
    },
    member: { type: 'string', maxLength: 60, description: 'uml.remove: remove only this attribute/operation (by name) of element id.' },
    root: { type: 'string', description: 'uml.scan: scan root, relative to cwd or absolute; persisted. Default: <cwd>/src if it exists, else <cwd>.' },
  },
} as const

export type ToolOps = { ops: DesignOp[]; path?: string; mode?: 'merge' | 'replace'; root?: string } | { error: string }

const isStr = (v: unknown): v is string => typeof v === 'string'
const nonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0
const has = (list: readonly string[], v: unknown): boolean => isStr(v) && list.includes(v)

/**
 * Map an authoring action (add | link | resolve | abandon | import) to ops. Never throws.
 * import with `path` returns {ops: [], path}; the shell reads the file and runs parseSeed.
 */
export function toolInputToOps(input: unknown): ToolOps {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'action: expected an object with an action' }
  const o = input as Record<string, unknown>
  const idErr = (field: string, v: unknown, required: boolean): string | null => {
    if (v === undefined && !required) return null
    if (!isStr(v)) return `${field}: required`
    return ID_RE.test(v) ? null : `${field}: "${v}" must match ${ID_PATTERN}`
  }
  const evErr = (v: unknown) => (v === undefined || (Array.isArray(v) && v.every(isStr)) ? null : 'evidence: expected an array of ids')
  switch (o.action) {
    case 'add': {
      if (!has(SOL_KINDS, o.kind)) return { error: `kind: add needs a node kind (${SOL_KINDS.join(', ')})` }
      if (!nonEmpty(o.label)) return { error: 'label: required' }
      const e = idErr('id', o.id, false) ?? evErr(o.evidence) ?? (o.detail !== undefined && !isStr(o.detail) ? 'detail: expected a string' : null)
      if (e) return { error: e }
      return one({ op: 'add', kind: o.kind, label: o.label, id: o.id, detail: o.detail, evidence: o.evidence })
    }
    case 'link': {
      if (!has(SOL_EDGE_KINDS, o.kind)) return { error: `kind: link needs an edge kind (${SOL_EDGE_KINDS.join(', ')})` }
      if (!nonEmpty(o.from)) return { error: 'from: required' }
      if (!nonEmpty(o.to)) return { error: 'to: required' }
      const e = idErr('from', o.from, true) ?? (o.kind === 'supported-by' ? null : idErr('to', o.to, true))
      if (e) return { error: e }
      return one({ op: 'link', from: o.from, to: o.to, kind: o.kind })
    }
    case 'resolve': {
      const e = idErr('id', o.id, true) ?? idErr('by', o.by, false) ?? evErr(o.evidence) ?? (o.note !== undefined && !isStr(o.note) ? 'note: expected a string' : null)
      if (e) return { error: e }
      return one({ op: 'resolve', id: o.id, by: o.by, note: o.note, evidence: o.evidence })
    }
    case 'abandon': {
      const e = idErr('id', o.id, true)
      if (e) return { error: e }
      if (!nonEmpty(o.reason)) return { error: 'reason: required (why the approach was dropped)' }
      return one({ op: 'abandon', id: o.id, reason: o.reason })
    }
    case 'import': {
      if (o.mode !== undefined && o.mode !== 'merge' && o.mode !== 'replace') return { error: 'mode: expected merge or replace' }
      const mode = o.mode as 'merge' | 'replace' | undefined
      if (o.ops !== undefined) {
        if (!Array.isArray(o.ops)) return { error: 'ops: expected an array' }
        const ops: DesignOp[] = []
        for (let i = 0; i < o.ops.length; i++) {
          const op = normaliseDesignOp(o.ops[i])
          if (!op) return { error: `ops[${i}]: malformed ${JSON.stringify(o.ops[i])?.slice(0, 80)}` }
          ops.push(op)
        }
        return mode ? { ops, mode } : { ops }
      }
      if (nonEmpty(o.path)) return mode ? { ops: [], path: o.path, mode } : { ops: [], path: o.path }
      return { error: 'ops or path: import needs inline ops or a seed file path' }
    }
    case 'uml.add':
    case 'uml.relate':
    case 'uml.remove':
      return umlOps(o)
    case 'uml.scan': {
      if (o.root === undefined) return { ops: [] }
      return isStr(o.root) ? { ops: [], root: o.root } : { error: 'root: expected a string' }
    }
    default:
      return { error: `action: "${String(o.action)}" is not an authoring action (actions: ${TOOL_ACTIONS.join(', ')})` }
  }
}

const UML_ID_RE = ID_RE
const optStrErr = (o: Record<string, unknown>, field: string, max?: number): string | null => {
  const v = o[field]
  if (v === undefined) return null
  if (!isStr(v)) return `${field}: expected a string`
  return max !== undefined && v.length > max ? `${field}: at most ${max} characters` : null
}
const strArrErr = (o: Record<string, unknown>, field: string): string | null => {
  const v = o[field]
  if (v === undefined) return null
  if (!Array.isArray(v) || !v.every(isStr)) return `${field}: expected an array of strings`
  if (v.length > 24) return `${field}: at most 24 entries`
  return v.every((s) => s.length <= 80) ? null : `${field}: each entry at most 80 characters`
}
const umlIdErr = (field: string, v: unknown, required: boolean): string | null => {
  if (v === undefined && !required) return null
  if (!isStr(v) || !v) return `${field}: required (a UML element id)`
  return UML_ID_RE.test(v) ? null : `${field}: "${v}" must match ${ID_PATTERN}`
}

/** uml.add | uml.relate | uml.remove -> one UmlOp, every field checked (errors name the field). */
function umlOps(o: Record<string, unknown>): ToolOps {
  if (o.decision === undefined || o.decision === '') return { error: 'decision: required (the decision that causes this change)' }
  if (!isStr(o.decision) || !DECISION_RE.test(o.decision)) return { error: `decision: "${String(o.decision)}" must match ${DECISION_PATTERN}` }
  if (o.cascade !== undefined) return { error: 'cascade: not a tool field (abandon the decision instead)' }
  let raw: Record<string, unknown>
  switch (o.action) {
    case 'uml.add': {
      if (!has(UML_KINDS, o.kind)) return { error: `kind: uml.add needs an element kind (${UML_KINDS.join(', ')})` }
      if (!nonEmpty(o.name)) return { error: 'name: required (the element name as drawn)' }
      if (o.name.length > 60) return { error: 'name: at most 60 characters' }
      const e =
        umlIdErr('id', o.id, false) ?? umlIdErr('in', o.in, false) ?? optStrErr(o, 'stereotype', 40) ?? optStrErr(o, 'code', 200) ??
        optStrErr(o, 'note', 140) ?? strArrErr(o, 'attributes') ?? strArrErr(o, 'operations')
      if (e) return { error: e }
      raw = { op: 'uml.add', decision: o.decision, kind: o.kind, name: o.name, id: o.id, stereotype: o.stereotype, in: o.in, code: o.code, note: o.note, attributes: o.attributes, operations: o.operations }
      break
    }
    case 'uml.relate': {
      if (!has(UML_REL_KINDS, o.kind)) return { error: `kind: uml.relate needs a relation kind (${UML_REL_KINDS.join(', ')})` }
      const e = umlIdErr('from', o.from, true) ?? umlIdErr('to', o.to, true) ?? optStrErr(o, 'label', 120)
      if (e) return { error: e }
      raw = { op: 'uml.relate', decision: o.decision, kind: o.kind, from: o.from, to: o.to, label: o.label }
      break
    }
    default: {
      if (!nonEmpty(o.reason)) return { error: 'reason: required (why it is removed)' }
      if (isStr(o.reason) && o.reason.length > 140) return { error: 'reason: at most 140 characters' }
      const byId = o.id !== undefined
      const byRel = o.from !== undefined || o.to !== undefined || o.kind !== undefined
      if (byId === byRel) return { error: 'id or from+kind+to: uml.remove needs exactly one target (id, id + member, or from + kind + to)' }
      if (byId) {
        const e = umlIdErr('id', o.id, true) ?? optStrErr(o, 'member', 60)
        if (e) return { error: e }
        if (o.member !== undefined && !nonEmpty(o.member)) return { error: 'member: expected a member name' }
      } else {
        if (o.member !== undefined) return { error: 'member: only with id (remove a member of element id)' }
        if (!has(UML_REL_KINDS, o.kind)) return { error: `kind: removing a relation needs a relation kind (${UML_REL_KINDS.join(', ')})` }
        const e = umlIdErr('from', o.from, true) ?? umlIdErr('to', o.to, true)
        if (e) return { error: e }
      }
      raw = { op: 'uml.remove', decision: o.decision, reason: o.reason, id: o.id, member: o.member, from: o.from, to: o.to, kind: o.kind }
    }
  }
  const op = normaliseDesignOp(raw)
  return op ? { ops: [op] } : { error: `action: could not build a ${String(o.action)} op` }
}

function one(o: Record<string, unknown>): { ops: SolOp[] } {
  const op = normaliseOp(o)
  return op ? { ops: [op] } : { ops: [] }
}
