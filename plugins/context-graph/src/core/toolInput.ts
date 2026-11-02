// context_graph tool input -> SolOp list (v2 design.md 5.4). Pure; the shell does the I/O.
import type { SolOp } from './solution-types.ts'
import { SOL_EDGE_KINDS, SOL_KINDS } from './solution-types.ts'
import { normaliseOp } from './solution.ts'

export const TOOL_ACTIONS = ['inspect', 'focus', 'clear', 'add', 'link', 'resolve', 'abandon', 'import'] as const
export type ToolAction = (typeof TOOL_ACTIONS)[number]
const ID_PATTERN = '^[a-z]+:[a-z0-9-]{1,48}$'
const ID_RE = new RegExp(ID_PATTERN)

export const TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: {
      type: 'string',
      enum: TOOL_ACTIONS,
      description:
        'inspect: solution model + what the current question touches; focus/clear: steer relevance; add/link/resolve/abandon: author the solution model; import: load a seed file or inline ops.',
    },
    kind: { type: 'string', enum: [...SOL_KINDS, ...SOL_EDGE_KINDS], description: 'add: node kind. link: edge kind.' },
    id: { type: 'string', pattern: ID_PATTERN, description: 'add (optional, default kind:slug(label)) / resolve / abandon: solution node id.' },
    label: { type: 'string', maxLength: 120, description: 'add: short name, cut to 60 chars.' },
    detail: { type: 'string', maxLength: 280, description: 'add: one or two sentences.' },
    evidence: { type: 'array', items: { type: 'string' }, maxItems: 12, description: 'add/resolve: transcript node ids (prompt:…, turn:…, tool:…, file:…) that support this; inspect lists them.' },
    from: { type: 'string', description: 'link: source solution id.' },
    to: { type: 'string', description: 'link: target solution id, or an evidence id for supported-by.' },
    by: { type: 'string', description: 'resolve: the decision id that settles the question or risk (adds decided-by).' },
    note: { type: 'string', maxLength: 140, description: 'resolve: how it was settled. focus: why these nodes matter (shown in the pane).' },
    reason: { type: 'string', maxLength: 140, description: 'abandon: why the approach was dropped (required).' },
    path: { type: 'string', description: 'import: a seed file (context-graph/solution@1 JSON), relative to cwd or absolute.' },
    ops: { type: 'array', items: { type: 'object' }, maxItems: 200, description: "import: inline SolOp list, same shape as a seed file's ops." },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'import: merge into the current model (default) or replace it.' },
    nodeIds: { type: 'array', items: { type: 'string' }, description: 'focus: solution or transcript node ids.' },
    match: { type: 'string', description: 'focus: text matched against node labels, solution labels and file paths.' },
  },
} as const

export type ToolOps = { ops: SolOp[]; path?: string; mode?: 'merge' | 'replace' } | { error: string }

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
        const ops: SolOp[] = []
        for (let i = 0; i < o.ops.length; i++) {
          const op = normaliseOp(o.ops[i])
          if (!op) return { error: `ops[${i}]: malformed ${JSON.stringify(o.ops[i])?.slice(0, 80)}` }
          ops.push(op)
        }
        return mode ? { ops, mode } : { ops }
      }
      if (nonEmpty(o.path)) return mode ? { ops: [], path: o.path, mode } : { ops: [], path: o.path }
      return { error: 'ops or path: import needs inline ops or a seed file path' }
    }
    default:
      return { error: `action: "${String(o.action)}" is not an authoring action (add, link, resolve, abandon, import)` }
  }
}

function one(o: Record<string, unknown>): { ops: SolOp[] } {
  const op = normaliseOp(o)
  return op ? { ops: [op] } : { ops: [] }
}
