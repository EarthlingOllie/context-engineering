// svg: Scene -> standalone SVG string for the desktop pane (design.md 4.5).
// No scripts, no event attributes; tooltips via <title>, hover via CSS, seed pulse via SMIL.
// Degrades (labels -> weak edges -> out-of-window nodes -> top N) to stay within maxChars.
import { SOL_COLOR_KINDS } from './scene.ts'
import type { Scene, SceneEdge, SceneItem } from './scene.ts'

export const SVG_MAX_CHARS = 131072
const LABELS = 12
/** blast weight at or above which a non-seed node gets a highlight halo */
const HALO_MIN = 0.2
const CHAR_W = 6.7 // 11px monospace advance, rounded up
const LINE_H = 13
interface Box { x: number; y: number; w: number; h: number }
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export interface SvgOptions { width: number; height: number; maxChars?: number; theme: 'dark' | 'light' }

const THEMES = {
  dark: { bg: '#0d1117', fg: '#c9d1d9', edge: '#8b949e', ring: '#ffd866', shade: 1 },
  // kind colours are tuned for a dark ground; scaling them by 0.65 keeps >= 3:1 contrast on white
  light: { bg: '#ffffff', fg: '#24292f', edge: '#57606a', ring: '#bf8700', shade: 0.65 },
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;'))
}
const f1 = (v: number) => String(Math.round(v * 10) / 10)
const hex = (c: number) => '#' + (c & 0xffffff).toString(16).padStart(6, '0')
const shade = (c: number, k: number) => k === 1 ? c : [16, 8, 0].reduce((out, sh) => out | (Math.round(((c >> sh) & 0xff) * k) << sh), 0)

interface Plan { items: SceneItem[]; edges: SceneEdge[]; labels: boolean }

function draw(scene: Scene, plan: Plan, o: SvgOptions): string {
  const t = THEMES[o.theme]
  const sx = o.width / Math.max(1, scene.width), sy = o.height / Math.max(1, scene.height)
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.width} ${o.height}" width="${o.width}" height="${o.height}" font-family="ui-monospace,monospace" font-size="11">`)
  out.push(`<style>.n circle{transition:transform .15s}.n:hover circle{transform-box:fill-box;transform-origin:center;transform:scale(1.35)}.n:hover{opacity:1}.label{fill:${t.fg};pointer-events:none}</style>`)
  out.push(`<rect width="100%" height="100%" fill="${t.bg}"/>`)
  if (plan.edges.length) {
    out.push(`<g stroke="${t.edge}" stroke-width="1">`)
    for (const e of [...plan.edges].sort((a, b) => b.depth - a.depth))
      out.push(`<line x1="${f1(e.x1 * sx)}" y1="${f1(e.y1 * sy)}" x2="${f1(e.x2 * sx)}" y2="${f1(e.y2 * sy)}" stroke-opacity="${f1(0.08 + 0.6 * e.weight)}"/>`)
    out.push('</g>')
  }
  const items = [...plan.items].sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : 1))
  for (const n of items) {
    const op = 0.15 + 0.85 * Math.max(0, Math.min(1, n.weight))
    const x = f1(n.x * sx), y = f1(n.y * sy), r = n.r
    const tip = `${n.kind} · ${n.label} · ${n.tokens} tok${n.hop !== undefined ? ` · hop ${n.hop}` : ''}${n.inWindow ? '' : ' · compacted'}`
    out.push(`<g class="n${n.seed ? ' seed' : ''}" opacity="${Math.round(op * 100) / 100}"><title>${escapeXml(tip)}</title>`)
    out.push(`<circle cx="${x}" cy="${y}" r="${f1(r)}" fill="${hex(shade(n.color, t.shade))}"${n.inWindow ? '' : ' fill-opacity="0.5"'}/>`)
    if (!n.seed && n.weight >= HALO_MIN) {
      out.push(`<circle class="halo" cx="${x}" cy="${y}" r="${f1(r + 2.5)}" fill="none" stroke="${t.ring}" stroke-width="${f1(1 + 1.5 * n.weight)}" stroke-opacity="${f1(0.35 + 0.6 * n.weight)}"/>`)
    }
    if (n.seed) {
      const dash = n.seed === 'model' ? ' stroke-dasharray="4 3"' : ''
      out.push(`<circle class="ring" cx="${x}" cy="${y}" r="${f1(r + 3)}" fill="none" stroke="${t.ring}" stroke-width="2"${dash}><animate attributeName="r" values="${f1(r + 3)};${f1(r + 7)};${f1(r + 3)}" dur="1.6s" repeatCount="indefinite"/></circle>`)
    }
    out.push('</g>')
  }
  if (plan.labels) {
    const top = [...plan.items].sort((a, b) => b.weight * b.tokens - a.weight * a.tokens || (a.id < b.id ? -1 : 1)).slice(0, LABELS)
    const placed: Box[] = []
    for (const n of top) {
      const text = n.label.length > 40 ? n.label.slice(0, 39) + '…' : n.label
      const w = text.length * CHAR_W, cx = n.x * sx, cy = n.y * sy, gap = n.r + 4
      const candidates: Box[] = [
        { x: cx + gap, y: cy - 6, w, h: LINE_H },
        { x: cx - gap - w, y: cy - 6, w, h: LINE_H },
        { x: cx - w / 2, y: cy - gap - LINE_H, w, h: LINE_H },
        { x: cx - w / 2, y: cy + gap, w, h: LINE_H },
      ]
      const spot = candidates.find((b) => b.x >= 0 && b.x + b.w <= o.width && b.y >= 0 && b.y + b.h <= o.height - 16 && !placed.some((p) => overlaps(p, b)))
      if (!spot) continue
      placed.push(spot)
      out.push(`<text class="label" x="${f1(spot.x)}" y="${f1(spot.y + 10)}">${escapeXml(text)}</text>`)
    }
  }
  const L = scene.legend
  const legend = `${L.nodes} nodes · blast ${L.blastNodes} nodes / ${L.tokensInRadius} tok of ${L.windowTokens ?? L.totalTokens}${L.note ? ` · ${L.note}` : ''}`
  out.push(`<text x="8" y="${o.height - 8}" fill="${t.fg}" opacity="0.8">${escapeXml(legend.slice(0, 160))}</text>`)
  out.push('</svg>')
  return out.join('')
}

export function renderSvg(scene: Scene, o: SvgOptions): string {
  const max = o.maxChars ?? SVG_MAX_CHARS
  if (scene.items.some((i) => i.layer) || scene.legend.solution) return renderLayered(scene, o, max)
  const all: Plan = { items: scene.items, edges: scene.edges, labels: true }
  const ladder: Plan[] = [
    all,
    { ...all, labels: false },
    { items: scene.items, edges: scene.edges.filter((e) => e.weight >= 0.25), labels: false },
    { items: scene.items.filter((n) => n.inWindow || n.seed), edges: scene.edges.filter((e) => e.weight >= 0.25), labels: false },
  ]
  for (const plan of ladder) {
    const s = draw(scene, plan, o)
    if (s.length <= max) return s
  }
  // Top N by weight (seeds first), with only the strongest edges; binary search the largest N that fits.
  const ranked = [...scene.items].sort((a, b) => Number(!!b.seed) - Number(!!a.seed) || b.weight - a.weight || b.tokens - a.tokens || (a.id < b.id ? -1 : 1))
  const strong = scene.edges.filter((e) => e.weight >= 0.25).sort((a, b) => b.weight - a.weight)
  const attempt = (n: number) => draw(scene, { items: ranked.slice(0, n), edges: strong.slice(0, n), labels: false }, o)
  let lo = 0, hi = ranked.length, best = ''
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const s = attempt(mid)
    if (s.length <= max) { best = s; lo = mid + 1 } else hi = mid - 1
  }
  if (best) return best
  const bare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.width} ${o.height}"></svg>`
  return bare.length <= max ? bare : '<svg></svg>'
}

// ---------------------------------------------------------------------------------------------
// v2 layered rendering (design.md 4.7): solution layer drawn over the evidence layer.

const HEALTH_STYLE = {
  dark: { 'in-window': '#3fb950', compacted: '#d29922', 'never-loaded': '#8b949e' },
  light: { 'in-window': '#1a7f37', compacted: '#9a6700', 'never-loaded': '#6e7781' },
} as const
const EDGE_STYLE: Record<string, { color: (t: 'dark' | 'light') => string; width: number; dash?: string; arrow?: boolean }> = {
  'depends-on': { color: (t) => (t === 'dark' ? '#8b949e' : '#57606a'), width: 1.5 },
  constrains: { color: () => '#d0700a', width: 1.5, arrow: true },
  'decided-by': { color: () => '#3b82e0', width: 1.5 },
  contradicts: { color: () => '#e0484a', width: 1.5, dash: '5 3' },
  'supported-by': { color: (t) => (t === 'dark' ? '#8b949e' : '#57606a'), width: 1, dash: '1 3' },
}
export const KIND_GLYPH: Record<string, string> = {
  goal: '◎', component: '●', decision: '■', requirement: '▲', constraint: '◆', assumption: '◇', dependency: '⬡', risk: '✕', question: '?',
}
const LABEL_RANK: Record<string, number> = { goal: 0, question: 1, component: 2, decision: 3 }

interface LPlan { sol: SceneItem[]; ev: SceneItem[]; edges: SceneEdge[]; evLabels: boolean; solLabels: boolean; compact: boolean }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const solOpacity = (n: SceneItem) => (n.status === 'abandoned' ? Math.min(0.2, 0.1 + 0.1 * clamp01(n.weight)) : 0.35 + 0.65 * clamp01(n.weight))
const r2 = (v: number) => Math.round(v * 100) / 100

/** Shape markup centred on the origin. `extra` carries status styling. */
function shapeMarkup(shape: string, r: number, extra: string): string {
  const pts = (list: [number, number][]) => list.map(([x, y]) => `${f1(x * r)},${f1(y * r)}`).join(' ')
  switch (shape) {
    case 'goal':
    case 'circle':
    case 'question':
      return `<circle class="shape" r="${f1(r)}"${extra}/>`
    case 'square':
      return `<rect class="shape" x="${f1(-0.85 * r)}" y="${f1(-0.85 * r)}" width="${f1(1.7 * r)}" height="${f1(1.7 * r)}"${extra}/>`
    case 'triangle':
      return `<polygon class="shape" points="${pts([[0, -1.1], [0.95, 0.6], [-0.95, 0.6]])}"${extra}/>`
    case 'diamond':
      return `<polygon class="shape" points="${pts([[0, -1.15], [1.15, 0], [0, 1.15], [-1.15, 0]])}"${extra}/>`
    case 'hex':
      return `<polygon class="shape" points="${pts([[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]])}"${extra}/>`
    case 'cross': {
      const a = 0.35, b = 1
      return `<polygon class="shape" points="${pts([[-b, -b + a], [-b + a, -b], [0, -a], [b - a, -b], [b, -b + a], [a, 0], [b, b - a], [b - a, b], [0, a], [-b + a, b], [-b, b - a], [-a, 0]])}"${extra}/>`
    }
    default:
      return `<circle class="shape" r="${f1(r)}"${extra}/>`
  }
}

function statusAttrs(n: SceneItem, color: string, bg: string): string {
  if (n.status === 'open') return ` fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 3"`
  if (n.kind === 'assumption') return ` fill="${bg}" stroke="${color}" stroke-width="2"`
  return ` fill="${color}" stroke="${bg}" stroke-width="1"`
}

function solColor(n: SceneItem, k: number): string {
  return hex(SOL_COLOR_KINDS.has(n.kind) ? n.color : shade(n.color, k))
}

function headerLine(scene: Scene): string {
  const S = scene.legend.solution
  if (!S) return ''
  const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const goal = S.goal ? `GOAL ${S.goal.length > 48 ? S.goal.slice(0, 47) + '…' : S.goal}` : 'no goal yet'
  return `${goal} · ${pl(S.components, 'component')} · ${pl(S.decisions, 'decision')} · ${pl(S.openQuestions, 'open question')} · health ${S.health.inWindow} in / ${S.health.compacted} compacted / ${S.health.missing} missing`
}

function drawLayered(scene: Scene, plan: LPlan, o: SvgOptions): string {
  const t = THEMES[o.theme]
  const hs = HEALTH_STYLE[o.theme]
  const sx = o.width / Math.max(1, scene.width), sy = o.height / Math.max(1, scene.height)
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.width} ${o.height}" width="${o.width}" height="${o.height}" font-family="ui-monospace,monospace" font-size="11">`)
  out.push(`<style>.s:hover{opacity:1}.label{fill:${t.fg};pointer-events:none}.ev:hover{opacity:1}</style>`)
  const defs: string[] = [`<marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#d0700a"/></marker>`]
  if (plan.compact) {
    const seen = new Set<string>()
    for (const n of plan.sol) {
      const key = `${n.kind}-${n.status ?? 'active'}`
      if (seen.has(key)) continue
      seen.add(key)
      const c = solColor(n, t.shade)
      defs.push(`<g id="y-${key}"${n.status === 'abandoned' ? ' opacity="0.2"' : ''}>${shapeMarkup(n.shape ?? 'circle', n.kind === 'goal' ? 9 : 5, statusAttrs(n, c, t.bg))}</g>`)
    }
  }
  out.push(`<defs>${defs.join('')}</defs>`)
  out.push(`<rect width="100%" height="100%" fill="${t.bg}"/>`)

  // Evidence edges, then evidence nodes.
  const evEdges = plan.edges.filter((e) => e.layer === 'evidence')
  if (evEdges.length) {
    out.push(`<g stroke="${t.edge}" stroke-width="1">`)
    for (const e of evEdges)
      out.push(`<line class="ev${e.weight < 0.25 ? ' weak' : ''}" x1="${f1(e.x1 * sx)}" y1="${f1(e.y1 * sy)}" x2="${f1(e.x2 * sx)}" y2="${f1(e.y2 * sy)}" stroke-opacity="${f1(0.06 + 0.5 * e.weight)}"/>`)
    out.push('</g>')
  }
  for (const n of [...plan.ev].sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : 1))) {
    const op = r2(0.15 + 0.6 * clamp01(n.weight))
    const tip = plan.compact ? '' : `<title>${escapeXml(`${n.kind} · ${n.label} · ${n.tokens} tok${n.inWindow ? '' : ' · compacted'}${n.cited ? ' · cited' : ''}`)}</title>`
    const attrs = `class="ev${n.cited ? ' cited' : ''}" cx="${f1(n.x * sx)}" cy="${f1(n.y * sy)}" r="${f1(n.r)}" fill="${hex(shade(n.color, t.shade))}" opacity="${op}"${n.inWindow ? '' : ' fill-opacity="0.5"'}`
    out.push(tip ? `<circle ${attrs}>${tip}</circle>` : `<circle ${attrs}/>`)
  }
  // Solution edges (supported-by first, faint).
  const solEdges = plan.edges.filter((e) => e.layer !== 'evidence').sort((a, b) => Number(b.kind === 'supported-by') - Number(a.kind === 'supported-by') || b.depth - a.depth)
  for (const e of solEdges) {
    const st = EDGE_STYLE[e.kind ?? 'depends-on'] ?? EDGE_STYLE['depends-on']!
    const op = e.kind === 'supported-by' ? Math.min(0.25, 0.08 + 0.2 * e.weight) : 0.3 + 0.65 * clamp01(e.weight)
    out.push(`<line class="e k-${e.kind}" x1="${f1(e.x1 * sx)}" y1="${f1(e.y1 * sy)}" x2="${f1(e.x2 * sx)}" y2="${f1(e.y2 * sy)}" stroke="${st.color(o.theme)}" stroke-width="${st.width}" stroke-opacity="${r2(op)}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}${st.arrow && !plan.compact ? ' marker-end="url(#arrow)"' : ''}/>`)
  }
  // Solution nodes, far to near.
  for (const n of [...plan.sol].sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : 1))) {
    const x = f1(n.x * sx), y = f1(n.y * sy)
    if (plan.compact) { out.push(`<use class="s" href="#y-${n.kind}-${n.status ?? 'active'}" x="${x}" y="${y}"/>`); continue }
    const c = solColor(n, t.shade)
    const ev = n.evidence ?? { inWindow: 0, compacted: 0, missing: 0 }
    const tip = `${n.kind} · ${n.status ?? 'active'} · ${n.label} · health ${n.health ?? 'never-loaded'} (${ev.inWindow}/${ev.compacted}/${ev.missing}) · relevance ${clamp01(n.weight).toFixed(2)}`
    const struck = n.status === 'abandoned' ? ' style="text-decoration:line-through"' : ''
    out.push(`<g class="s" data-id="${escapeXml(n.id)}" data-kind="${n.kind}" data-status="${n.status ?? 'active'}" data-health="${n.health ?? 'never-loaded'}" opacity="${r2(solOpacity(n))}"${struck}><title>${escapeXml(tip)}</title><g transform="translate(${x} ${y})"><g>`)
    if (n.isNew) out.push('<animateTransform attributeName="transform" type="scale" from="0" to="1" dur="0.6s" fill="freeze"/><animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>')
    out.push(shapeMarkup(n.shape ?? 'circle', n.r, statusAttrs(n, c, t.bg)))
    if (n.kind === 'goal') out.push(`<circle r="${f1(n.r * 0.5)}" fill="${n.status === 'open' ? 'none' : t.bg}" stroke="${c}" stroke-width="2"/>`)
    if (n.kind === 'question') out.push(`<text text-anchor="middle" y="${f1(Math.min(n.r, 11) * 0.4)}" font-size="${f1(Math.max(8, Math.min(14, n.r * 1.3)))}" font-weight="bold" fill="${n.status === 'open' ? c : t.bg}">?</text>`)
    const h = n.health ?? 'never-loaded'
    const hr = f1(n.r + 3.5)
    if (h === 'in-window') out.push(`<circle class="health in-window" r="${hr}" fill="none" stroke="${hs[h]}" stroke-width="1.5"/>`)
    else if (h === 'compacted') out.push(`<circle class="health compacted" r="${hr}" fill="none" stroke="${hs[h]}" stroke-width="1.5" stroke-dasharray="2 2"/>`)
    else out.push(`<circle class="health never-loaded" r="${hr}" fill="none" stroke="${hs[h]}" stroke-width="1"/><text class="hg" x="${f1(n.r + 3)}" y="${f1(-n.r - 1)}" fill="${hs[h]}" font-size="14">·</text>`)
    out.push('</g></g></g>')
  }
  // Labels: solution first (goal, open questions, components, decisions), then evidence.
  const want = [
    ...(plan.solLabels ? plan.sol.filter((n) => n.labelled).sort((a, b) => (LABEL_RANK[a.kind] ?? 9) - (LABEL_RANK[b.kind] ?? 9) || b.weight - a.weight || (a.id < b.id ? -1 : 1)) : []),
    ...(plan.evLabels ? plan.ev.filter((n) => n.labelled).sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1)) : []),
  ]
  const placed: Box[] = [{ x: 0, y: 0, w: o.width, h: 18 }]
  for (const n of want) {
    const sol = n.layer === 'solution'
    const maxLen = n.kind === 'goal' ? 48 : sol ? 32 : 26
    const text = n.label.length > maxLen ? n.label.slice(0, maxLen - 1) + '…' : n.label
    const w = text.length * CHAR_W, cx = n.x * sx, cy = n.y * sy, gap = n.r + (sol ? 6 : 3)
    const candidates: Box[] = [
      { x: cx + gap, y: cy - 6, w, h: LINE_H },
      { x: cx - gap - w, y: cy - 6, w, h: LINE_H },
      { x: cx - w / 2, y: cy - gap - LINE_H, w, h: LINE_H },
      { x: cx - w / 2, y: cy + gap, w, h: LINE_H },
    ]
    const spot = candidates.find((b) => b.x >= 0 && b.x + b.w <= o.width && b.y >= 0 && b.y + b.h <= o.height - 16 && !placed.some((p) => overlaps(p, b)))
    if (!spot) continue
    placed.push(spot)
    const style = sol
      ? `${n.kind === 'goal' ? ' font-weight="bold"' : ''}${n.status === 'abandoned' ? ' opacity="0.4" text-decoration="line-through"' : ` opacity="${r2(0.55 + 0.45 * clamp01(n.weight))}"`}`
      : ` opacity="0.6" font-size="10"`
    out.push(`<text class="label ${sol ? 'sol' : 'ev'}" x="${f1(spot.x)}" y="${f1(spot.y + 10)}"${style}>${escapeXml(text)}</text>`)
  }
  // Header and legend.
  const head = headerLine(scene)
  // Shrink the font (down to 7px) so the header and legend lines fit the width.
  const fit = (chars: number, base: number) => f1(Math.max(7, Math.min(base, (o.width - 16) / (Math.max(1, chars) * 0.62))))
  const headText = head.slice(0, 180)
  if (head) out.push(`<text class="header" x="8" y="13" fill="${t.fg}" font-weight="bold" font-size="${fit(headText.length, 11)}">${escapeXml(headText)}</text>`)
  const kinds = scene.legend.solution?.kinds ?? []
  const L = scene.legend
  const tail = `evidence ${L.nodes} nodes · focus ${L.blastNodes} / ${L.tokensInRadius} tok${L.note ? ` · ${L.note}` : ''}`
  const parts = kinds.map((k) => `<tspan fill="${hex(SOL_COLOR_KINDS.has(k) ? kindColor(scene, k) : 0x8b949e)}">${KIND_GLYPH[k] ?? '●'}</tspan> ${k}`)
  const tailText = tail.slice(0, 120)
  const legendChars = kinds.reduce((a, k) => a + k.length + 4, 0) + tailText.length
  out.push(`<text class="legend" x="8" y="${o.height - 6}" fill="${t.fg}" opacity="0.85" font-size="${fit(legendChars, 10)}">${parts.join('  ')}${parts.length ? ' · ' : ''}${escapeXml(tailText)}</text>`)
  out.push('</svg>')
  return out.join('')
}

function kindColor(scene: Scene, k: string): number {
  return scene.items.find((i) => i.kind === k)?.color ?? 0x8b949e
}

function renderLayered(scene: Scene, o: SvgOptions, max: number): string {
  const sol = scene.items.filter((i) => i.layer === 'solution')
  const ev = scene.items.filter((i) => i.layer !== 'solution')
  const present = (items: SceneItem[]) => new Set(items.map((i) => i.id))
  const keep = (edges: SceneEdge[], items: SceneItem[]) => {
    const ids = present(items)
    return edges.filter((e) => !e.from || !e.to || (ids.has(e.from) && ids.has(e.to)))
  }
  const strong = (e: SceneEdge) => !(e.layer === 'evidence' && e.weight < 0.25)
  const full: LPlan = { sol, ev, edges: scene.edges, evLabels: true, solLabels: true, compact: false }
  const p1: LPlan = { ...full, evLabels: false }
  const p2: LPlan = { ...p1, edges: scene.edges.filter(strong) }
  const ev3 = ev.filter((n) => n.cited)
  const p3: LPlan = { ...p2, ev: ev3, edges: keep(p2.edges, [...sol, ...ev3]) }
  const p4: LPlan = { ...p3, solLabels: false }
  const p5: LPlan = { ...p4, edges: p4.edges.filter((e) => e.weight >= 0.25) }
  const ev6 = ev3.filter((n) => n.inWindow)
  const p6: LPlan = { ...p5, ev: ev6, edges: keep(p5.edges, [...sol, ...ev6]) }
  const p7: LPlan = { ...p6, compact: true }
  const p8: LPlan = { ...p7, edges: p7.edges.filter((e) => e.layer === 'solution' && e.kind !== 'supported-by') }
  for (const plan of [full, p1, p2, p3, p4, p5, p6, p7, p8]) {
    const s = drawLayered(scene, plan, o)
    if (s.length <= max) return s
  }
  // Compact solution, no edges: largest top-N of solution nodes (goal, open questions, weight) that fits.
  const ranked = [...sol].sort((a, b) => Number(b.kind === 'goal') - Number(a.kind === 'goal') || Number(b.status === 'open') - Number(a.status === 'open') || b.weight - a.weight || (a.id < b.id ? -1 : 1))
  let lo = 0, hi = ranked.length, best = ''
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const s = drawLayered(scene, { sol: ranked.slice(0, mid), ev: [], edges: [], evLabels: false, solLabels: false, compact: true }, o)
    if (s.length <= max) { best = s; lo = mid + 1 } else hi = mid - 1
  }
  if (best) return best
  const bare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.width} ${o.height}"></svg>`
  return bare.length <= max ? bare : '<svg></svg>'
}
