// The Mermaid classDiagram emitter (v3 design.md 4.6, deep module #15). Pure.
// No user text reaches the output unsanitised: names come from ids reduced to [A-Za-z0-9_], display names, members
// and labels lose the characters Mermaid treats as syntax, and the words of Mermaid's interaction statements are
// broken up. Clicks and init directives are never emitted.
import type { Diagram, DiagramElement, DiagramRelation } from './diagram.ts'
import type { UmlRelKind } from './uml-types.ts'

export interface MermaidOut { text: string; /** element id -> Mermaid class name */ names: Record<string, string> }
export interface MermaidOptions { direction?: 'LR' | 'TB'; maxMembers?: number; maxChars?: number }

const ARROW: Record<UmlRelKind, string> = {
  association: '-->', dependency: '..>', realization: '..|>', composition: '*--', generalization: '--|>',
}
/** Mark classes, in emission order; neutral defaults the page overrides with theme colours. */
const MARKS: [string, string][] = [
  ['cgAdded', 'stroke:#888,stroke-width:3px'],
  ['cgChanged', 'stroke:#888,stroke-width:2px,stroke-dasharray:6 3'],
  ['cgRemoved', 'stroke:#888,stroke-dasharray:4 4'],
  ['cgAbandoned', 'stroke:#888,stroke-dasharray:2 4'],
  ['cgPlanned', 'stroke:#888,stroke-dasharray:5 3'],
  ['cgBuilt', 'stroke:#888,stroke-dasharray:1 3'],
  ['cgStale', 'stroke:#888,stroke-width:2px'],
  ['cgMatch', 'stroke:#888'],
]
const RISKY = /(click|callback|href)/gi

/** Breaks the words of Mermaid interaction statements with a zero-width space. */
const defuse = (s: string): string => s.replace(RISKY, (w) => `${w[0]}​${w.slice(1)}`)

export function sanitizeMember(text: string): string {
  const s = String(text ?? '')
    .replace(/%%/g, '')
    .replace(/[<>]/g, '~')
    .replace(/\|/g, '/')
    .replace(/[{};"`%]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // markdown autolinks (email, scheme://, www.) render as "Unsupported markdown: link": break them
    .replace(/@(?=\S)/g, '@\u200B')
    .replace(/:\/\//g, ':\u200B//')
    .replace(/\bwww\./gi, (w) => `${w.slice(0, 3)}\u200B.`)
  return defuse(s)
}

const displayName = (name: string): string => sanitizeMember(String(name ?? '').replace(/"/g, "'").replace(/[[\]{}]/g, '')).replace(/"/g, "'")

export function mermaidName(id: string, taken: Set<string>): string {
  const colon = id.indexOf(':')
  const prefix = id.startsWith('code:') ? 'B_' : 'E_'
  const body = (colon >= 0 && /^[a-z]+$/.test(id.slice(0, colon)) ? id.slice(colon + 1) : id)
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(RISKY, (w) => `${w[0]}_${w.slice(1)}`)
  const base = prefix + body
  let n = base
  for (let k = 2; taken.has(n); k++) n = `${base}_${k}`
  taken.add(n)
  return n
}

function markOf(e: DiagramElement): string | null {
  if (e.change === 'added') return 'cgAdded'
  if (e.change === 'changed') return 'cgChanged'
  if (e.change === 'removed') return 'cgRemoved'
  if (e.status === 'removed') return 'cgRemoved'
  if (e.status === 'abandoned') return 'cgAbandoned'
  switch (e.flag) {
    case 'matching': return 'cgMatch'
    case 'planned-not-built': return 'cgPlanned'
    case 'built-not-planned': return 'cgBuilt'
    case 'removed-but-built': return 'cgStale'
    default: return null
  }
}

function annotation(e: DiagramElement): string | null {
  if (e.kind === 'component') return 'component'
  if (e.kind === 'interface') return 'interface'
  const st = (e.stereotype ?? '').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 40)
  return st ? defuse(st) : null
}

function emit(d: Diagram, o: Required<MermaidOptions>, level: number): MermaidOut {
  const lines = ['classDiagram', `  direction ${o.direction}`]
  const taken = new Set<string>()
  const names: Record<string, string> = {}
  const shown = level >= 2 ? d.elements.filter((e) => e.source !== 'actual') : d.elements
  for (const e of shown) names[e.id] = mermaidName(e.id, taken)
  for (const e of shown) {
    lines.push(`  class ${names[e.id]}["${displayName(e.name)}"] {`)
    const ann = annotation(e)
    if (ann) lines.push(`    <<${ann}>>`)
    if (level < 1) {
      if (e.stereotype && e.kind !== 'class') {
        const st = sanitizeMember(e.stereotype)
        if (st) lines.push(`    «${st}»`)
      }
      const members = e.members.filter((m) => !m.removed).map((m) => {
        const t = sanitizeMember(m.text)
        return t ? (m.flag === 'planned-not-built' ? `${t} ◌` : t) : ''
      }).filter(Boolean)
      for (const t of members.slice(0, o.maxMembers)) lines.push(`    ${t}`)
      if (members.length > o.maxMembers) lines.push(`    …+${members.length - o.maxMembers} more`)
    }
    lines.push('  }')
  }
  for (const r of d.relations) {
    const a = names[r.from]
    const b = names[r.to]
    if (!a || !b) continue
    lines.push(`  ${a} ${ARROW[r.kind]} ${b}${level >= 3 ? '' : relLabel(r)}`)
  }
  if (shown.length) {
    for (const [c, style] of MARKS) lines.push(`  classDef ${c} ${style}`)
    const groups = new Map<string, string[]>()
    for (const e of shown) {
      const m = markOf(e)
      if (m) groups.set(m, [...(groups.get(m) ?? []), names[e.id]!])
    }
    for (const [c] of MARKS) {
      const g = groups.get(c)
      if (g) lines.push(`  cssClass "${g.join(',')}" ${c}`)
    }
  }
  if (level > 0) lines.push('%% truncated')
  return { text: lines.join('\n') + (level > 0 ? '' : '\n'), names }
}

function relLabel(r: DiagramRelation): string {
  const parts: string[] = []
  const l = r.label ? sanitizeMember(r.label).replace(/:/g, ' ').trim() : ''
  if (l) parts.push(l)
  if (r.status !== 'active') parts.push('✗')
  else if (r.flag === 'planned-not-built') parts.push('◌')
  return parts.length ? ` : ${parts.join(' ')}` : ''
}

export function toMermaid(d: Diagram, opts: MermaidOptions = {}): MermaidOut {
  const o: Required<MermaidOptions> = {
    direction: opts.direction === 'TB' ? 'TB' : 'LR',
    maxMembers: Math.max(0, Math.floor(opts.maxMembers ?? 10)),
    maxChars: Math.max(0, Math.floor(opts.maxChars ?? 60000)),
  }
  let out = emit(d, o, 0)
  for (let level = 1; level <= 3 && out.text.length > o.maxChars; level++) out = emit(d, o, level)
  return out
}
