// Intended vs actual (v3 design.md 4.4, deep module #13). Pure.
// Matches each intended UML element of a snapshot against the scanned code, checks members and relations, and
// lists what is built but not planned. Deterministic and independent of record order.
import type { ActualDesign, ActualModule, ActualRelation, ActualType } from './codeScan.ts'
import type { UmlSnapshot } from './timeline.ts'
import type { UmlElement, UmlRelation } from './uml-types.ts'

export type UmlFlag = 'matching' | 'planned-not-built' | 'built-not-planned' | 'removed-but-built' | 'unchecked'
export const UML_FLAGS: readonly UmlFlag[] = ['matching', 'planned-not-built', 'built-not-planned', 'removed-but-built', 'unchecked']

export interface ElementCheck {
  /** null: removed and not built (gone as intended) */
  flag: UmlFlag | null
  /** module path or type id it matched (for npm/outside refs: the first module that imports it) */
  actual?: string
  /** several candidates matched by name; the first path in sort order won */
  ambiguous?: true
  /** active members of active matched (not unchecked) elements, by member name */
  members: Record<string, 'matching' | 'planned-not-built'>
}
export interface CrossCheck {
  elements: Record<string, ElementCheck>
  relations: Record<string, UmlFlag | null>
  /** built-not-planned, sorted */
  unplanned: { modules: string[]; types: string[]; relations: ActualRelation[] }
  /** intended elements with a non-null flag, plus unplanned modules as built-not-planned */
  counts: Record<UmlFlag, number>
}
export type CodeRef =
  | { kind: 'absent' }
  | { kind: 'none' }
  | { kind: 'npm'; pkg: string }
  | { kind: 'path'; path: string; name?: string; member?: string; outside: boolean; folder: boolean }

const EXT = /\.(d\.)?(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const stripExt = (p: string): string => p.replace(EXT, '')
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const sortedKeys = (r: Record<string, unknown>): string[] => Object.keys(r).sort(cmp)
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function parseCodeRef(code: string | undefined): CodeRef {
  const c = typeof code === 'string' ? code.trim() : ''
  if (!c) return { kind: 'absent' }
  if (c === 'none') return { kind: 'none' }
  if (c.startsWith('npm:')) {
    const parts = c.slice(4).split('/')
    const pkg = parts[0]!.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0]!
    return pkg ? { kind: 'npm', pkg } : { kind: 'absent' }
  }
  const hash = c.indexOf('#')
  let path = hash >= 0 ? c.slice(0, hash) : c
  const frag = hash >= 0 ? c.slice(hash + 1) : ''
  while (path.startsWith('./')) path = path.slice(2)
  const folder = path.endsWith('/')
  if (!folder) path = stripExt(path)
  const outside = path.startsWith('../') || path === '..' || path.startsWith('/')
  const ref: Extract<CodeRef, { kind: 'path' }> = { kind: 'path', path, outside, folder }
  const dot = frag.indexOf('.')
  const name = dot >= 0 ? frag.slice(0, dot) : frag
  const member = dot >= 0 ? frag.slice(dot + 1) : ''
  if (name) ref.name = name
  if (member) ref.member = member
  return ref
}

/** What an element resolved to: a set of modules (for relation lifting), or an external end. */
type End =
  | { kind: 'unchecked' }
  | { kind: 'none' }
  | { kind: 'modules'; modules: string[]; type?: string }
  | { kind: 'npm'; pkg: string }
  | { kind: 'outside'; prefix: string }

interface Resolved { end: End; actual?: string; ambiguous?: true }

const outsideMatches = (entry: string, prefix: string): boolean => {
  const e = stripExt(entry)
  const p = prefix.replace(/\/+$/, '')
  return e === p || e.startsWith(`${p}/`) || entry.startsWith(`${p}/`)
}

function resolveElement(el: UmlElement, a: ActualDesign, mods: string[], types: string[]): Resolved {
  const ref = parseCodeRef(el.code)
  const none: Resolved = { end: { kind: 'none' } }
  if (ref.kind === 'none') return { end: { kind: 'unchecked' } }
  if (ref.kind === 'npm') {
    const m = mods.find((p) => a.modules[p]!.externals.includes(ref.pkg))
    return m ? { end: { kind: 'npm', pkg: ref.pkg }, actual: m } : none
  }
  if (ref.kind === 'path') {
    if (ref.outside) {
      const m = mods.find((p) => a.modules[p]!.outside.some((o) => outsideMatches(o, ref.path)))
      return m ? { end: { kind: 'outside', prefix: ref.path }, actual: m } : { end: { kind: 'unchecked' } }
    }
    if (ref.folder) {
      const under = mods.filter((p) => p.startsWith(ref.path))
      return under.length ? { end: { kind: 'modules', modules: under }, actual: ref.path } : none
    }
    const candidates = mods.filter((p) => stripExt(p) === ref.path || stripExt(p) === `${ref.path}/index`)
    const mod = candidates[0]
    if (!mod) return none
    if (el.kind === 'component') {
      if (ref.name) {
        const m = a.modules[mod]!
        const found = m.functions.some((f) => f.name === ref.name) || m.consts.some((f) => f.name === ref.name)
        return found ? { end: { kind: 'modules', modules: [mod] }, actual: mod } : none
      }
      return { end: { kind: 'modules', modules: [mod] }, actual: mod }
    }
    const want = ref.name ?? null
    const t = want !== null
      ? (a.types[`${mod}#${want}`] ? `${mod}#${want}` : undefined)
      : types.find((id) => a.types[id]!.module === mod && a.types[id]!.kind === el.kind && norm(a.types[id]!.name) === norm(el.name))
    return t ? { end: { kind: 'modules', modules: [mod], type: t }, actual: t } : none
  }
  // absent: unique normalised name match of the same kind
  const key = norm(el.name)
  if (!key) return none
  if (el.kind === 'component') {
    const hits = mods.filter((p) => norm(a.modules[p]!.name) === key)
    if (!hits.length) return none
    const r: Resolved = { end: { kind: 'modules', modules: [hits[0]!] }, actual: hits[0]! }
    if (hits.length > 1) r.ambiguous = true
    return r
  }
  const hits = types.filter((id) => a.types[id]!.kind === el.kind && norm(a.types[id]!.name) === key)
  if (!hits.length) return none
  const t = hits[0]!
  const r: Resolved = { end: { kind: 'modules', modules: [a.types[t]!.module], type: t }, actual: t }
  if (hits.length > 1) r.ambiguous = true
  return r
}

function memberCheck(el: UmlElement, res: Resolved, a: ActualDesign): Record<string, 'matching' | 'planned-not-built'> {
  const out: Record<string, 'matching' | 'planned-not-built'> = {}
  const end = res.end
  let ops: Set<string>, attrs: Set<string>
  if (end.kind !== 'modules') return out
  if (end.type) {
    const t: ActualType = a.types[end.type]!
    const all = new Set([...t.attributes, ...t.operations].map((m) => m.name))
    ops = all
    attrs = all
  } else if (end.modules.length === 1 && el.kind === 'component' && res.actual === end.modules[0]) {
    const m: ActualModule = a.modules[end.modules[0]!]!
    ops = new Set(m.functions.map((f) => f.name))
    attrs = new Set(m.consts.map((f) => f.name))
  } else {
    // folder refs: any module under it
    ops = new Set(end.modules.flatMap((p) => a.modules[p]!.functions.map((f) => f.name)))
    attrs = new Set(end.modules.flatMap((p) => a.modules[p]!.consts.map((f) => f.name)))
  }
  for (const mem of el.members) {
    if (mem.status !== 'active') continue
    const pool = mem.kind === 'operation' ? ops : attrs
    out[mem.name] = pool.has(mem.name) ? 'matching' : 'planned-not-built'
  }
  return out
}

/** Modules `from` reaches: its deps, then re-exports of those, up to 3 hops. */
function reach(a: ActualDesign, from: string): Set<string> {
  const seen = new Set<string>(a.modules[from]?.deps ?? [])
  let frontier = [...seen]
  for (let hop = 0; hop < 3 && frontier.length; hop++) {
    const next: string[] = []
    for (const p of frontier) for (const r of a.modules[p]?.reexports ?? []) if (!seen.has(r)) { seen.add(r); next.push(r) }
    frontier = next
  }
  return seen
}

function relationFound(rel: UmlRelation, f: End, t: End, a: ActualDesign, typeRels: Set<string>): boolean {
  if (rel.kind === 'realization' || rel.kind === 'generalization') {
    return f.kind === 'modules' && t.kind === 'modules' && !!f.type && !!t.type && typeRels.has(`${f.type}|${rel.kind}|${t.type}`)
  }
  if (f.kind !== 'modules') return false
  if (rel.kind === 'association' && t.kind === 'modules' && f.type && t.type && typeRels.has(`${f.type}|association|${t.type}`)) return true
  for (const from of f.modules) {
    const m = a.modules[from]!
    if (t.kind === 'npm' && m.externals.includes(t.pkg)) return true
    if (t.kind === 'outside' && m.outside.some((o) => outsideMatches(o, t.prefix))) return true
    if (t.kind === 'modules') {
      if (t.modules.includes(from)) return true
      const r = reach(a, from)
      if (t.modules.some((p) => r.has(p))) return true
    }
  }
  return false
}

export function crossCheck(s: UmlSnapshot, actual: ActualDesign): CrossCheck {
  const mods = sortedKeys(actual.modules)
  const types = sortedKeys(actual.types)
  const out: CrossCheck = {
    elements: {}, relations: {}, unplanned: { modules: [], types: [], relations: [] },
    counts: { matching: 0, 'planned-not-built': 0, 'built-not-planned': 0, 'removed-but-built': 0, unchecked: 0 },
  }
  const ends = new Map<string, End>()
  const planned = new Set<string>()
  const matchedTypes = new Set<string>()
  for (const id of sortedKeys(s.elements)) {
    const el = s.elements[id]!
    const res = resolveElement(el, actual, mods, types)
    ends.set(id, res.end)
    const matched = res.end.kind !== 'none' && res.end.kind !== 'unchecked'
    let flag: UmlFlag | null
    if (res.end.kind === 'unchecked') flag = 'unchecked'
    else if (el.status === 'active') flag = matched ? 'matching' : 'planned-not-built'
    else flag = matched ? 'removed-but-built' : null
    const check: ElementCheck = { flag, members: flag === 'matching' ? memberCheck(el, res, actual) : {} }
    if (matched && res.actual) check.actual = res.actual
    if (matched && res.ambiguous) check.ambiguous = true
    out.elements[id] = check
    if (flag) out.counts[flag]++
    if (res.end.kind === 'modules') {
      for (const p of res.end.modules) planned.add(p)
      if (res.end.type && el.kind !== 'component') matchedTypes.add(res.end.type)
    }
  }

  const typeRels = new Set(actual.relations.filter((r) => r.kind !== 'dependency').map((r) => `${r.from}|${r.kind}|${r.to}`))
  const covered = new Set<string>()
  for (const id of sortedKeys(s.relations)) {
    const rel = s.relations[id]!
    const f = ends.get(rel.from) ?? { kind: 'none' as const }
    const t = ends.get(rel.to) ?? { kind: 'none' as const }
    if (f.kind === 'modules' && t.kind === 'modules') {
      for (const x of f.modules) for (const y of t.modules) { covered.add(`${x}|${y}`); covered.add(`${y}|${x}`) }
    }
    let flag: UmlFlag | null
    if (f.kind === 'unchecked' || t.kind === 'unchecked') flag = 'unchecked'
    else {
      const found = f.kind !== 'none' && t.kind !== 'none' && relationFound(rel, f, t, actual, typeRels)
      flag = rel.status === 'active' ? (found ? 'matching' : 'planned-not-built') : found ? 'removed-but-built' : null
    }
    out.relations[id] = flag
  }

  for (const p of mods) if (!planned.has(p)) out.unplanned.modules.push(p)
  out.counts['built-not-planned'] = out.unplanned.modules.length
  for (const id of types) if (actual.types[id]!.exported && !matchedTypes.has(id)) out.unplanned.types.push(id)
  const rels = actual.relations
    .filter((r) => r.kind === 'dependency' && planned.has(r.from) && planned.has(r.to) && !covered.has(`${r.from}|${r.to}`))
    .map((r) => ({ ...r }))
    .sort((x, y) => cmp(x.from, y.from) || cmp(x.to, y.to))
  out.unplanned.relations = rels
  return out
}
