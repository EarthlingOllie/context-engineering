// umlPane: the mod pane's UML view (v3 design.md 4.7, deep module #16). Pure, no DOM.
// layoutUml ranks a Diagram into layered boxes (dependents above what they depend on), renderUmlSvg draws it as a
// standalone SVG (no scripts, no event attributes), rasterUml draws it into terminal Raster cells.
import type { UmlFlag } from './crossCheck.ts'
import type { Diagram, DiagramElement } from './diagram.ts'
import { DEFAULT_BG, MAX_COLS, MAX_ROWS } from './raster.ts'
import { escapeXml, SVG_MAX_CHARS, THEMES } from './svg.ts'
import type { UmlChange, UmlRelKind } from './uml-types.ts'

export interface UmlBox {
  id: string; x: number; y: number; w: number; h: number; title: string; kindLine: string; members: string[]
  flag: UmlFlag | null; status: DiagramElement['status']; change: UmlChange | null; rank: number
}
export interface UmlEdge {
  id: string; from: string; to: string; kind: UmlRelKind; points: [number, number][]; label?: string
  flag: UmlFlag | null; status: string; change: UmlChange | null
}
export interface UmlLayout { w: number; h: number; scale: number; boxes: UmlBox[]; edges: UmlEdge[]; dropped: { members: boolean; unplanned: number; removed: number } }
export interface UmlLayoutOptions { charW?: number; lineH?: number; maxMembers?: number }

/** Kind, flag and accent colours per theme; each keeps >= 3:1 contrast on the v2 THEMES background. */
export const UML_COLORS = {
  dark: {
    kind: { component: '#58a6ff', class: '#bc8cff', interface: '#39c5cf' },
    flag: { matching: '#3fb950', 'planned-not-built': '#d29922', 'built-not-planned': '#8b949e', 'removed-but-built': '#f85149', unchecked: '#8b949e' },
    accent: '#ffd866',
  },
  light: {
    kind: { component: '#0969da', class: '#8250df', interface: '#1b7c83' },
    flag: { matching: '#1a7f37', 'planned-not-built': '#9a6700', 'built-not-planned': '#6e7781', 'removed-but-built': '#cf222e', unchecked: '#6e7781' },
    accent: '#bf8700',
  },
} as const

const BADGE: Record<UmlFlag, string> = { matching: '✓', 'planned-not-built': '◌', 'built-not-planned': '+', 'removed-but-built': '!', unchecked: '' }
const MIN_W = 80, MAX_W = 220, PAD = 8, HEADER = 24, GAP_X = 24, GAP_RANK = 40, GAP_ROW = 20, MIN_SCALE = 0.6
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const cut = (s: string, n: number): string => { const cps = Array.from(s); return cps.length <= n ? s : cps.slice(0, Math.max(0, n - 1)).join('') + '…' }
const len = (s: string): number => Array.from(s).length

function kindLineOf(e: DiagramElement): string {
  if (e.kind === 'class') return e.stereotype ? `«${e.stereotype}»` : ''
  return e.stereotype ? `«${e.kind}, ${e.stereotype}»` : `«${e.kind}»`
}

interface Node { e: DiagramElement; w: number; h: number; title: string; kindLine: string; members: string[]; rank: number }

/** Ranks by longest path over the graph with DFS back edges reversed (visited in id order); isolated nodes last. */
function rank(ids: string[], pairs: [string, string][]): Map<string, number> {
  const out = new Map<string, string[]>()
  for (const id of ids) out.set(id, [])
  const connected = new Set<string>()
  for (const [a, b] of pairs) { if (a === b) continue; out.get(a)!.push(b); connected.add(a); connected.add(b) }
  for (const l of out.values()) l.sort(cmp)
  // DFS (iterative) to find back edges.
  const state = new Map<string, number>() // 1 on stack, 2 done
  const dag = new Map<string, string[]>()
  for (const id of ids) dag.set(id, [])
  for (const root of [...ids].sort(cmp)) {
    if (state.has(root)) continue
    const stack: [string, number][] = [[root, 0]]
    state.set(root, 1)
    while (stack.length) {
      const top = stack[stack.length - 1]!
      const [v, i] = top
      const succ = out.get(v)!
      if (i >= succ.length) { state.set(v, 2); stack.pop(); continue }
      top[1] = i + 1
      const w = succ[i]!
      const s = state.get(w)
      if (s === 1) dag.get(w)!.push(v) // back edge reversed
      else { dag.get(v)!.push(w); if (s === undefined) { state.set(w, 1); stack.push([w, 0]) } }
    }
  }
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]))
  for (const l of dag.values()) for (const w of l) indeg.set(w, indeg.get(w)! + 1)
  const r = new Map<string, number>(ids.map((id) => [id, 0]))
  const queue = ids.filter((id) => indeg.get(id) === 0)
  for (let q = 0; q < queue.length; q++) {
    const v = queue[q]!
    for (const w of dag.get(v)!) {
      r.set(w, Math.max(r.get(w)!, r.get(v)! + 1))
      indeg.set(w, indeg.get(w)! - 1)
      if (indeg.get(w) === 0) queue.push(w)
    }
  }
  let max = -1
  for (const id of connected) max = Math.max(max, r.get(id)!)
  for (const id of ids) if (!connected.has(id)) r.set(id, max + 1)
  return r
}

function orderRanks(ranks: Node[][], pairs: [string, string][]): void {
  const preds = new Map<string, string[]>(), succs = new Map<string, string[]>()
  for (const [a, b] of pairs) {
    if (a === b) continue
    ;(succs.get(a) ?? succs.set(a, []).get(a)!).push(b)
    ;(preds.get(b) ?? preds.set(b, []).get(b)!).push(a)
  }
  const pos = new Map<string, number>()
  const index = () => { for (const row of ranks) row.forEach((n, i) => pos.set(n.e.id, i)) }
  index()
  const sweep = (row: Node[], nb: Map<string, string[]>) => {
    const key = new Map<string, number>()
    row.forEach((n, i) => {
      const ns = (nb.get(n.e.id) ?? []).filter((x) => pos.has(x))
      key.set(n.e.id, ns.length ? ns.reduce((s, x) => s + pos.get(x)!, 0) / ns.length : i)
    })
    row.sort((a, b) => key.get(a.e.id)! - key.get(b.e.id)! || pos.get(a.e.id)! - pos.get(b.e.id)!)
    row.forEach((n, i) => pos.set(n.e.id, i))
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 1; r < ranks.length; r++) sweep(ranks[r]!, preds)
    for (let r = ranks.length - 2; r >= 0; r--) sweep(ranks[r]!, succs)
  }
}

interface Placed { nodes: Node[]; x: Map<string, number>; y: Map<string, number>; cw: number; ch: number }

function place(ranks: Node[][], wrapW: number): Placed {
  const rows: { nodes: Node[]; w: number; h: number; gapAfter: number }[] = []
  for (const rk of ranks) {
    let cur: Node[] = [], cw = 0
    const flush = (gap: number) => { rows.push({ nodes: cur, w: cw, h: Math.max(...cur.map((n) => n.h)), gapAfter: gap }); cur = []; cw = 0 }
    for (const n of rk) {
      const add = (cur.length ? GAP_X : 0) + n.w
      if (cur.length && cw + add > wrapW) flush(GAP_ROW)
      cw += (cur.length ? GAP_X : 0) + n.w
      cur.push(n)
    }
    if (cur.length) flush(GAP_RANK)
  }
  const cw = Math.max(1, ...rows.map((r) => r.w))
  const x = new Map<string, number>(), y = new Map<string, number>()
  let yy = 0
  rows.forEach((row, i) => {
    let xx = (cw - row.w) / 2
    for (const n of row.nodes) { x.set(n.e.id, xx); y.set(n.e.id, yy + (row.h - n.h) / 2); xx += n.w + GAP_X }
    yy += row.h + (i < rows.length - 1 ? row.gapAfter : 0)
  })
  return { nodes: ranks.flat(), x, y, cw, ch: Math.max(1, yy) }
}

/** Point where the segment from the centre of b towards (tx, ty) leaves b. */
function clip(b: { x: number; y: number; w: number; h: number }, tx: number, ty: number): [number, number] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  const t = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity, 1)
  return [cx + dx * t, cy + dy * t]
}

function attempt(d: Diagram, els: DiagramElement[], withMembers: boolean, size: { w: number; h: number }, o: Required<UmlLayoutOptions>) {
  const nodes: Node[] = els.map((e) => {
    const kindLine = kindLineOf(e)
    const active = e.members.filter((m) => !m.removed).map((m) => m.text + (m.flag === 'planned-not-built' ? ' ◌' : ''))
    const shown = withMembers ? (active.length > o.maxMembers ? [...active.slice(0, o.maxMembers - 1), `…+${active.length - o.maxMembers + 1} more`] : active) : []
    const longest = Math.max(len(e.name), len(kindLine), ...shown.map(len))
    const room = e.flag && BADGE[e.flag] ? 12 : 0 // keeps the top-right badge clear of the kind line
    const w = Math.max(MIN_W, Math.min(MAX_W, longest * o.charW + 16 + room))
    const fit = Math.max(1, Math.floor((w - 16 - room) / o.charW))
    return { e, w, h: (2 + shown.length) * o.lineH + 8, title: cut(e.name, fit), kindLine: cut(kindLine, fit), members: shown.map((s) => cut(s, fit)), rank: 0 }
  })
  const present = new Set(nodes.map((n) => n.e.id))
  const rels = d.relations.filter((r) => present.has(r.from) && present.has(r.to))
  const pairs: [string, string][] = rels.map((r) => [r.from, r.to])
  const rk = rank(nodes.map((n) => n.e.id), pairs)
  const ranks: Node[][] = []
  for (const n of nodes) { n.rank = rk.get(n.e.id)!; (ranks[n.rank] ??= []).push(n) }
  const dense = ranks.filter(Boolean)
  dense.forEach((row, i) => { for (const n of row) n.rank = i })
  orderRanks(dense, pairs)
  const availW = Math.max(1, size.w - 2 * PAD), availH = Math.max(1, size.h - HEADER - PAD)
  const widest = Math.max(MIN_W, ...nodes.map((n) => n.w))
  let best: { p: Placed; scale: number } | null = null
  for (const k of [1, 1.5, 2, 3, 4, 6, 8]) {
    const p = place(dense, Math.max(widest, availW * k))
    const scale = Math.min(1, availW / p.cw, availH / p.ch)
    if (!best || scale > best.scale + 1e-9) best = { p, scale }
  }
  return { nodes, rels, ...best! }
}

export function layoutUml(d: Diagram, size: { w: number; h: number }, opts: UmlLayoutOptions = {}): UmlLayout {
  const o: Required<UmlLayoutOptions> = { charW: opts.charW ?? 6.6, lineH: opts.lineH ?? 14, maxMembers: Math.max(1, opts.maxMembers ?? 4) }
  const W = Number.isFinite(size.w) && size.w > 0 ? size.w : 1, H = Number.isFinite(size.h) && size.h > 0 ? size.h : 1
  const unplanned = (e: DiagramElement) => e.source === 'actual'
  const removed = (e: DiagramElement) => e.source === 'intended' && e.status !== 'active'
  const all = d.elements
  const ladder = [
    { members: true, els: all },
    { members: false, els: all },
    { members: false, els: all.filter((e) => !unplanned(e)) },
    { members: false, els: all.filter((e) => !unplanned(e) && !removed(e)) },
  ]
  let level = 0, a = attempt(d, ladder[0]!.els, true, { w: W, h: H }, o)
  while (a.scale < MIN_SCALE && level < ladder.length - 1) {
    level++
    a = attempt(d, ladder[level]!.els, ladder[level]!.members, { w: W, h: H }, o)
  }
  const s = a.scale
  const availW = Math.max(1, W - 2 * PAD)
  const ox = PAD + Math.max(0, (availW - a.p.cw * s) / 2), oy = HEADER
  const boxes: UmlBox[] = a.nodes.map((n) => ({
    id: n.e.id, x: ox + a.p.x.get(n.e.id)! * s, y: oy + a.p.y.get(n.e.id)! * s, w: n.w * s, h: n.h * s,
    title: n.title, kindLine: n.kindLine, members: n.members, flag: n.e.flag, status: n.e.status, change: n.e.change, rank: n.rank,
  }))
  const byId = new Map(boxes.map((b) => [b.id, b]))
  const edges: UmlEdge[] = a.rels.map((r) => {
    const A = byId.get(r.from)!, B = byId.get(r.to)!
    let points: [number, number][]
    if (A === B) points = [[A.x + A.w * 0.75, A.y], [A.x + A.w, A.y + A.h * 0.25]]
    else points = [clip(A, B.x + B.w / 2, B.y + B.h / 2), clip(B, A.x + A.w / 2, A.y + A.h / 2)]
    const e: UmlEdge = { id: r.id, from: r.from, to: r.to, kind: r.kind, points, flag: r.flag, status: r.status, change: r.change }
    if (r.label) e.label = r.label
    return e
  })
  const shown = new Set(boxes.map((b) => b.id))
  return {
    w: W, h: H, scale: s, boxes, edges,
    dropped: { members: level >= 1, unplanned: all.filter((e) => unplanned(e) && !shown.has(e.id)).length, removed: all.filter((e) => removed(e) && !shown.has(e.id)).length },
  }
}

// ---------------------------------------------------------------------------------------------
// SVG

export interface UmlSvgOptions { width: number; height: number; theme: 'dark' | 'light'; maxChars?: number }
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f￾￿]/g
/** XML-escaped, control characters dropped, '=' as a character reference so no text reads like an on*= attribute. */
const esc = (s: string) => escapeXml(s.replace(CTRL, '')).replace(/=/g, '&#61;')
const f1 = (v: number) => String(Math.round(v * 10) / 10)
const MARK_END: Record<UmlRelKind, 'start' | 'end'> = { association: 'end', dependency: 'end', realization: 'end', generalization: 'end', composition: 'start' }
const DASHED: Record<UmlRelKind, boolean> = { association: false, dependency: true, realization: true, generalization: false, composition: false }

export function headerLine(d: Diagram): string {
  const c = d.counts
  const label = d.decision?.label ?? (d.step === 0 ? 'before any decision' : '')
  return `Step ${d.step}/${d.steps} · ${label} · ✓${c.matching} ◌${c['planned-not-built']} +${c['built-not-planned']} !${c['removed-but-built']} ?${c.unchecked}`
}

interface SvgPlan { tips: boolean; members: boolean; labels: boolean; edges: boolean }

function drawSvg(l: UmlLayout, d: Diagram, o: UmlSvgOptions, plan: SvgPlan): string {
  const t = THEMES[o.theme], C = UML_COLORS[o.theme]
  const sx = o.width / Math.max(1, l.w), sy = o.height / Math.max(1, l.h)
  const k = Math.max(0.3, l.scale * Math.min(sx, sy))
  const fs = 11 * k, lh = 14 * k
  const els = new Map(d.elements.map((e) => [e.id, e]))
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.width} ${o.height}" width="${o.width}" height="${o.height}" font-family="ui-monospace,monospace" font-size="${f1(fs)}">`)
  out.push(`<style>g[data-kind] text{fill:${t.fg}}g[data-kind] .k{opacity:.7}g[data-kind] .t{font-weight:bold}.edge-label{fill:${t.fg};opacity:.75}</style>`)
  out.push('<defs>')
  const m = (id: string, path: string, fill: string, orient: string, refX: number) =>
    out.push(`<marker id="m-${id}" viewBox="0 0 10 10" refX="${refX}" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="${orient}"><path d="${path}" fill="${fill}" stroke="${t.edge}" stroke-width="1"/></marker>`)
  m('association', 'M0,0 L10,5 L0,10', 'none', 'auto', 10)
  m('dependency', 'M0,0 L10,5 L0,10', 'none', 'auto', 10)
  m('realization', 'M0,0 L10,5 L0,10 z', t.bg, 'auto', 10)
  m('generalization', 'M0,0 L10,5 L0,10 z', t.bg, 'auto', 10)
  m('composition', 'M0,5 L5,1 L10,5 L5,9 z', t.edge, 'auto', 0)
  out.push('</defs>')
  out.push(`<rect width="100%" height="100%" fill="${t.bg}"/>`)
  if (plan.edges) {
    for (const e of l.edges) {
      const [[x1, y1] = [0, 0], [x2, y2] = [0, 0]] = e.points
      const col = e.flag && e.flag !== 'matching' && e.flag !== 'unchecked' ? C.flag[e.flag] : t.edge
      const dash = DASHED[e.kind] ? ' stroke-dasharray="5 3"' : ''
      const op = e.status !== 'active' ? ' opacity="0.35"' : ''
      const width = e.change === 'added' || e.change === 'changed' ? 2.2 : 1.2
      out.push(`<line class="edge" data-id="${esc(e.id)}" data-kind="${e.kind}" data-status="${esc(e.status)}" x1="${f1(x1 * sx)}" y1="${f1(y1 * sy)}" x2="${f1(x2 * sx)}" y2="${f1(y2 * sy)}" stroke="${col}" stroke-width="${width}"${dash}${op} marker-${MARK_END[e.kind]}="url(#m-${e.kind})"/>`)
      if (plan.labels && e.label) out.push(`<text class="edge-label" x="${f1(((x1 + x2) / 2) * sx + 3)}" y="${f1(((y1 + y2) / 2) * sy - 3)}" font-size="${f1(fs * 0.9)}">${esc(cut(e.label, 24))}${e.status !== 'active' ? ' ✗' : ''}</text>`)
    }
  }
  for (const b of l.boxes) {
    const e = els.get(b.id)
    const kind = e?.kind ?? 'class'
    const x = b.x * sx, y = b.y * sy, w = b.w * sx, h = b.h * sy
    const faded = b.status !== 'active'
    const stroke = b.flag === 'planned-not-built' || b.flag === 'built-not-planned' || b.flag === 'removed-but-built' ? C.flag[b.flag] : C.kind[kind]
    const dash = b.flag === 'planned-not-built' ? ' stroke-dasharray="5 3"' : b.flag === 'built-not-planned' ? ' stroke-dasharray="1 3"' : ''
    out.push(`<g class="uml-box" data-id="${esc(b.id)}" data-kind="${kind}" data-flag="${b.flag ?? 'none'}" data-status="${b.status}" data-change="${b.change ?? 'none'}"${faded ? ' opacity="0.45"' : ''}>`)
    if (plan.tips) {
      const tip = [kind, e?.name ?? b.title, b.flag ?? 'unflagged', b.status, e?.code ?? '', (e?.decisions ?? []).join(', ')].filter(Boolean).join(' · ')
      out.push(`<title>${esc(cut(tip, 300))}</title>`)
    }
    out.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="4" fill="${t.bg}"/>`) // hides edges under the box
    out.push(`<rect class="frame" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="4" fill="${C.kind[kind]}" fill-opacity="0.08" stroke="${stroke}" stroke-width="1.5"${dash}/>`)
    if (b.change === 'added') out.push(`<rect class="hl" x="${f1(x - 3)}" y="${f1(y - 3)}" width="${f1(w + 6)}" height="${f1(h + 6)}" rx="6" fill="none" stroke="${C.accent}" stroke-width="3"><animate attributeName="stroke-opacity" values="1;0.2;1" dur="1.2s" repeatCount="2"/></rect>`)
    else if (b.change === 'changed') out.push(`<rect class="hl" x="${f1(x - 3)}" y="${f1(y - 3)}" width="${f1(w + 6)}" height="${f1(h + 6)}" rx="6" fill="none" stroke="${C.accent}" stroke-width="2" stroke-dasharray="4 3"/>`)
    else if (b.change === 'removed') out.push(`<rect class="hl" x="${f1(x - 3)}" y="${f1(y - 3)}" width="${f1(w + 6)}" height="${f1(h + 6)}" rx="6" fill="none" stroke="${C.flag['removed-but-built']}" stroke-width="2"/>`)
    const tx = x + 8 * k
    let ty = y + 4 * k + lh * 0.8
    if (b.kindLine) out.push(`<text class="k" x="${f1(tx)}" y="${f1(ty)}">${esc(b.kindLine)}</text>`)
    ty += lh
    out.push(`<text class="t" x="${f1(tx)}" y="${f1(ty)}"${faded ? ' style="text-decoration:line-through"' : ''}>${esc(b.title)}</text>`)
    if (plan.members && b.members.length) {
      const dy = y + 4 * k + 2 * lh + 2 * k
      out.push(`<line x1="${f1(x)}" y1="${f1(dy)}" x2="${f1(x + w)}" y2="${f1(dy)}" stroke="${stroke}" stroke-opacity="0.5"/>`)
      b.members.forEach((mm, i) => out.push(`<text x="${f1(tx)}" y="${f1(dy + lh * (i + 0.85))}">${esc(mm)}</text>`))
    }
    const badge = b.flag ? BADGE[b.flag] : ''
    if (badge) out.push(`<text class="badge" x="${f1(x + w - 5 * k)}" y="${f1(y + lh * 0.95)}" text-anchor="end" font-weight="bold" style="fill:${C.flag[b.flag!]}">${badge}</text>`)
    out.push('</g>')
  }
  out.push(`<text x="8" y="16" fill="${t.fg}" opacity="0.85">${esc(cut(headerLine(d), 160))}</text>`)
  if (!l.boxes.length) out.push(`<text x="${f1(o.width / 2)}" y="${f1(o.height / 2)}" text-anchor="middle" fill="${t.fg}" opacity="0.7">No UML yet: Claude records it with context_graph uml.add</text>`)
  out.push('</svg>')
  return out.join('')
}

export function renderUmlSvg(l: UmlLayout, d: Diagram, opts: UmlSvgOptions): string {
  const max = opts.maxChars ?? SVG_MAX_CHARS
  const ladder: SvgPlan[] = [
    { tips: true, members: true, labels: true, edges: true },
    { tips: false, members: true, labels: true, edges: true },
    { tips: false, members: false, labels: true, edges: true },
    { tips: false, members: false, labels: false, edges: true },
    { tips: false, members: false, labels: false, edges: false },
  ]
  for (const plan of ladder) {
    const s = drawSvg(l, d, opts, plan)
    if (s.length <= max) return s
  }
  const bare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.width} ${opts.height}"></svg>`
  return bare.length <= max ? bare : '<svg></svg>'
}

// ---------------------------------------------------------------------------------------------
// Raster

/** Cell size the terminal pane assumes: lay out at cols*8 x rows*16 px with charW 8 and lineH 16 for 1:1 text. */
export const RASTER_CELL = { w: 8, h: 16 } as const
const CP = { space: 0x20, h: 0x2500, v: 0x2502, tl: 0x250c, tr: 0x2510, bl: 0x2514, br: 0x2518, dh: 0x2504, dv: 0x2506, dot: 0xb7, ell: 0x2026,
  right: 0x25b8, left: 0x25c2, up: 0x25b4, down: 0x25be, diamond: 0x25c6 }
const num = (h: string) => parseInt(h.slice(1), 16) >>> 0
const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(v) ? v : lo)))
const safeCp = (cp: number) => (cp >= 0x20 && cp < 0x7f ? cp : 0x3f)

export function rasterUml(l: UmlLayout, d: Diagram, cols: number, rows: number, theme: 'dark' | 'light'): Uint32Array {
  const Cn = clampInt(cols, 1, MAX_COLS), Rn = clampInt(rows, 1, MAX_ROWS), n = Cn * Rn
  const C = UML_COLORS[theme]
  const edgeCol = num(THEMES[theme].edge), fgCol = num(THEMES[theme].fg)
  const cp = new Uint32Array(n).fill(CP.space), fg = new Uint32Array(n).fill(fgCol)
  const sx = Cn / Math.max(1, l.w), sy = Rn / Math.max(1, l.h)
  const els = new Map(d.elements.map((e) => [e.id, e]))
  const put = (c: number, r: number, ch: number, col: number) => {
    if (c < 0 || r < 0 || c >= Cn || r >= Rn) return
    cp[r * Cn + c] = ch; fg[r * Cn + c] = col
  }
  const taken = new Uint8Array(n) // box cells, interiors included: edges never cross a box
  const free = (c: number, r: number) => c >= 0 && r >= 0 && c < Cn && r < Rn && !taken[r * Cn + c] && cp[r * Cn + c] === CP.space
  // Boxes first, so edges only fill the gaps between them.
  const rects = new Map<string, { c0: number; r0: number; c1: number; r1: number }>()
  for (const b of [...l.boxes].sort((p, q) => p.y - q.y || p.x - q.x)) { // top to bottom, so pushes cascade down
    const c0 = clampInt(b.x * sx, 0, Cn - 1)
    let r0 = clampInt(b.y * sy, 0, Rn - 1)
    const c1 = Math.max(c0 + 2, Math.floor((b.x + b.w) * sx) - 1)
    let r1 = Math.max(r0 + 2, Math.floor((b.y + b.h) * sy) - 1)
    // A box rounded up to three rows can reach the next row of boxes: push it down until its cells are free.
    const hits = () => [...rects.values()].some((q) => c0 <= q.c1 && q.c0 <= c1 && r0 <= q.r1 && q.r0 <= r1)
    for (let guard = 0; guard < Rn && hits() && r1 + 1 < Rn; guard++) { r0++; r1++ }
    rects.set(b.id, { c0, r0, c1, r1 })
    for (let r = r0; r <= Math.min(r1, Rn - 1); r++) for (let c = c0; c <= Math.min(c1, Cn - 1); c++) taken[r * Cn + c] = 1
    const kind = els.get(b.id)?.kind ?? 'class'
    const faded = b.status !== 'active'
    const dashed = b.flag === 'planned-not-built' || faded
    const flagged = b.flag === 'planned-not-built' || b.flag === 'built-not-planned' || b.flag === 'removed-but-built'
    let col = num(flagged ? C.flag[b.flag!] : C.kind[kind])
    if (faded) col = num(C.flag.unchecked)
    const H = dashed ? CP.dh : CP.h, V = dashed ? CP.dv : CP.v
    for (let c = c0 + 1; c < c1; c++) { put(c, r0, H, col); put(c, r1, H, col) }
    for (let r = r0 + 1; r < r1; r++) { put(c0, r, V, col); put(c1, r, V, col); for (let c = c0 + 1; c < c1; c++) put(c, r, CP.space, col) }
    put(c0, r0, CP.tl, col); put(c1, r0, CP.tr, col); put(c0, r1, CP.bl, col); put(c1, r1, CP.br, col)
    const inner = c1 - c0 - 1
    const lines = [b.title, ...b.members]
    for (let i = 0; i < lines.length && r0 + 1 + i < r1; i++) {
      const cps = Array.from(lines[i]!).map((ch) => (ch === '…' ? CP.ell : safeCp(ch.codePointAt(0)!)))
      const shown = cps.length > inner ? [...cps.slice(0, Math.max(0, inner - 1)), CP.ell] : cps
      shown.forEach((ch, j) => put(c0 + 1 + j, r0 + 1 + i, ch, i === 0 ? (faded ? col : fgCol) : dimmed(fgCol)))
    }
    const badge = b.flag ? BADGE[b.flag] : ''
    if (badge) put(c1 - 1, r0, badge.codePointAt(0)!, num(C.flag[b.flag!]))
  }
  for (const e of l.edges) {
    const A = rects.get(e.from), B = rects.get(e.to)
    if (!A || !B || A === B) continue
    const ax = (A.c0 + A.c1) / 2, ay = (A.r0 + A.r1) / 2, bx = (B.c0 + B.c1) / 2, by = (B.r0 + B.r1) / 2
    let x0 = Math.round(ax), y0 = Math.round(ay)
    const x1 = Math.round(bx), y1 = Math.round(by)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), stx = x0 < x1 ? 1 : -1, sty = y0 < y1 ? 1 : -1
    let err = dx + dy
    const path: [number, number][] = []
    for (let guard = 0; guard < 4 * (Cn + Rn); guard++) {
      if (free(x0, y0)) path.push([x0, y0])
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += stx }
      if (e2 <= dx) { err += dx; y0 += sty }
    }
    if (!path.length) continue
    const col = e.flag && e.flag !== 'matching' && e.flag !== 'unchecked' ? num(C.flag[e.flag]) : edgeCol
    for (const [c, r] of path) put(c, r, CP.dot, col)
    const [hc, hr] = path[path.length - 1]!
    const vx = bx - ax, vy = (by - ay) * 2 // cells are ~2x taller than wide
    if (e.kind === 'composition') put(path[0]![0], path[0]![1], CP.diamond, col)
    else put(hc, hr, Math.abs(vx) >= Math.abs(vy) ? (vx >= 0 ? CP.right : CP.left) : (vy >= 0 ? CP.down : CP.up), col)
  }
  const out = new Uint32Array(n * 3)
  for (let k = 0; k < n; k++) { out[k * 3] = cp[k]!; out[k * 3 + 1] = fg[k]!; out[k * 3 + 2] = DEFAULT_BG }
  return out
}

function dimmed(c: number): number {
  const ch = (s: number) => Math.round(((c >> s) & 0xff) * 0.8) << s
  return (ch(16) | ch(8) | ch(0)) >>> 0
}
