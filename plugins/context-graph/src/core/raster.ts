// raster: Scene -> terminal Raster cells (design.md 4.6).
// Edges as braille sub-pixels (2x4 per cell, Bresenham); nodes as discs of glyphs coloured by
// kind and dimmed by weight; the nearer node wins a cell. Words are [codePoint, fg, bg] u32s.
import type { Scene } from './scene.ts'

export const DEFAULT_BG = 0x01000000
export const MAX_COLS = 512
export const MAX_ROWS = 256
const SPACE = 0x20
const FULL = 0x2588 // █
const DOT = 0x25cf // ●
const SMALL = 0x2022 // •
const BRAILLE = 0x2800
// Braille dot bits by [sub-x][sub-y].
const BIT = [[0x01, 0x02, 0x04, 0x40], [0x08, 0x10, 0x20, 0x80]] as const

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(v) ? v : lo)))

/** Scale a 0xRRGGBB colour by f in [0,1]. */
export function dim(color: number, f: number): number {
  const k = Math.max(0, Math.min(1, f))
  const ch = (s: number) => Math.round(((color >> s) & 0xff) * k) << s
  return (ch(16) | ch(8) | ch(0)) >>> 0
}

export function rasterize(scene: Scene, cols: number, rows: number): Uint32Array {
  const C = clampInt(cols, 1, MAX_COLS), R = clampInt(rows, 1, MAX_ROWS)
  const n = C * R
  const cp = new Uint32Array(n).fill(SPACE)
  const fg = new Uint32Array(n).fill(DEFAULT_BG)
  const zbuf = new Float64Array(n).fill(Infinity)
  const bits = new Uint8Array(n)
  const edgeW = new Float32Array(n)
  const sx = C / Math.max(1, scene.width), sy = R / Math.max(1, scene.height)

  // Edges -> braille sub-pixel grid (2C x 4R).
  const W = C * 2, H = R * 4
  const plot = (px: number, py: number, w: number) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const c = px >> 1, r = py >> 2, k = r * C + c
    bits[k] = bits[k]! | BIT[px & 1]![py & 3]!
    if (w > edgeW[k]!) edgeW[k] = w
  }
  for (const e of scene.edges) {
    let x0 = Math.round(e.x1 * sx * 2), y0 = Math.round(e.y1 * sy * 4)
    const x1 = Math.round(e.x2 * sx * 2), y1 = Math.round(e.y2 * sy * 4)
    if (![x0, y0, x1, y1].every(Number.isFinite)) continue
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const stx = x0 < x1 ? 1 : -1, sty = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (let guard = 0; guard < 4 * (W + H); guard++) {
      plot(x0, y0, e.weight)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += stx }
      if (e2 <= dx) { err += dx; y0 += sty }
    }
  }
  for (let k = 0; k < n; k++) {
    if (!bits[k]) continue
    cp[k] = BRAILLE + bits[k]!
    fg[k] = dim(0xb0b8c4, 0.3 + 0.6 * edgeW[k]!)
  }

  // Nodes: discs in cell space (cells are ~2x taller than wide, so y radius is halved).
  for (const it of scene.items) {
    const cx = it.x * sx, cy = it.y * sy
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue
    const rc = it.r * sx
    const color = dim(it.color, (0.3 + 0.7 * Math.max(0, Math.min(1, it.weight))) * (it.inWindow ? 1 : 0.6))
    const paint = (c: number, r: number, glyph: number) => {
      if (c < 0 || r < 0 || c >= C || r >= R) return
      const k = r * C + c
      if (it.depth >= zbuf[k]!) return
      zbuf[k] = it.depth; cp[k] = glyph; fg[k] = color
    }
    if (rc < 1.5) {
      paint(Math.floor(cx), Math.floor(cy), rc < 0.75 ? SMALL : DOT)
      continue
    }
    const ry = rc / 2
    for (let r = Math.floor(cy - ry); r <= Math.ceil(cy + ry); r++)
      for (let c = Math.floor(cx - rc); c <= Math.ceil(cx + rc); c++) {
        const ux = (c + 0.5 - cx) / rc, uy = (r + 0.5 - cy) / ry
        if (ux * ux + uy * uy <= 1) paint(c, r, FULL)
      }
    paint(Math.floor(cx), Math.floor(cy), FULL)
  }

  const out = new Uint32Array(n * 3)
  for (let k = 0; k < n; k++) {
    out[k * 3] = cp[k]!
    out[k * 3 + 1] = fg[k]!
    out[k * 3 + 2] = DEFAULT_BG
  }
  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64 of the words as little-endian bytes; no Buffer needed. */
export function toBase64(words: Uint32Array): string {
  const bytes = new Uint8Array(words.length * 4)
  const dv = new DataView(bytes.buffer)
  for (let i = 0; i < words.length; i++) dv.setUint32(i * 4, words[i]!, true)
  const parts: string[] = []
  let chunk = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2]
    const v = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    chunk += B64[(v >> 18) & 63]! + B64[(v >> 12) & 63]! + (b === undefined ? '=' : B64[(v >> 6) & 63]!) + (c === undefined ? '=' : B64[v & 63]!)
    if (chunk.length >= 8192) { parts.push(chunk); chunk = '' }
  }
  parts.push(chunk)
  return parts.join('')
}
