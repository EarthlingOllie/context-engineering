// svg: Scene -> standalone SVG string for the desktop pane (design.md 4.5).
// No scripts, no event attributes; tooltips via <title>, hover via CSS, seed pulse via SMIL.
// Degrades (labels -> weak edges -> out-of-window nodes -> top N) to stay within maxChars.
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
  dark: { bg: '#0d1117', fg: '#c9d1d9', edge: '#8b949e', ring: '#ffd866' },
  light: { bg: '#ffffff', fg: '#24292f', edge: '#57606a', ring: '#bf8700' },
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;'))
}
const f1 = (v: number) => String(Math.round(v * 10) / 10)
const hex = (c: number) => '#' + (c & 0xffffff).toString(16).padStart(6, '0')

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
    out.push(`<circle cx="${x}" cy="${y}" r="${f1(r)}" fill="${hex(n.color)}"${n.inWindow ? '' : ' fill-opacity="0.5"'}/>`)
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
