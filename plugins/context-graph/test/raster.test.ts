// Feature 14: Scene -> terminal cells ([codePoint, fg, bg] u32 triplets) and their base64.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rasterize, toBase64, DEFAULT_BG } from '../src/core/raster.ts'
import type { Scene, SceneItem } from '../src/core/scene.ts'

const item = (id: string, over: Partial<SceneItem> = {}): SceneItem => ({
  id, kind: 'tool', label: id, tokens: 100, x: 400, y: 300, depth: 50, r: 6, weight: 1, inWindow: true, color: 0x5ccf91, ...over,
})
const scene = (items: SceneItem[], edges: Scene['edges'] = []): Scene => ({
  width: 800, height: 600, items, edges, legend: { tokensInRadius: 0, totalTokens: 0, nodes: items.length, blastNodes: 0 },
})
const busy = scene(
  Array.from({ length: 60 }, (_, i) => item(`n${i}`, { x: (i * 97) % 800, y: (i * 61) % 600, r: 2 + (i % 30), depth: i, weight: (i % 5) / 4, color: 0x123456 * (i + 1) })),
  Array.from({ length: 80 }, (_, i) => ({ x1: (i * 13) % 800, y1: (i * 7) % 600, x2: (i * 29) % 800, y2: (i * 31) % 600, weight: (i % 4) / 3, depth: i })),
)
const cell = (cells: Uint32Array, cols: number, c: number, r: number) => { const k = (r * cols + c) * 3; return [cells[k]!, cells[k + 1]!, cells[k + 2]!] }

test('80x30 gives 7200 words of printable single-width BMP code points and valid colours', () => {
  const cells = rasterize(busy, 80, 30)
  assert.equal(cells.length, 7200)
  let drawn = 0
  for (let k = 0; k < cells.length; k += 3) {
    const cp = cells[k]!
    assert.ok(cp >= 0x20 && cp !== 0x7f && cp < 0x10000 && !(cp >= 0x80 && cp < 0xa0) && !(cp >= 0x300 && cp < 0x370), `cp ${cp.toString(16)}`)
    assert.ok(cells[k + 1]! <= 0x01000000 && cells[k + 2]! <= 0x01000000)
    if (cp !== 0x20) drawn++
  }
  assert.ok(drawn > 50, `only ${drawn} drawn cells`)
})

test('a node at the frame centre lands in the centre cell in its kind colour', () => {
  const cells = rasterize(scene([item('c', { color: 0xff8800 })]), 80, 30)
  const [cp, fg] = cell(cells, 80, 40, 15)
  assert.notEqual(cp, 0x20)
  assert.equal(fg, 0xff8800)
})

test('the nearer node wins a shared cell; low weight dims the colour', () => {
  const cells = rasterize(scene([item('far', { depth: 90, color: 0x0000ff }), item('near', { depth: 10, color: 0xff0000 })]), 80, 30)
  assert.equal(cell(cells, 80, 40, 15)[1], 0xff0000)
  const dim = rasterize(scene([item('d', { weight: 0, color: 0xff0000 })]), 80, 30)
  const fg = cell(dim, 80, 40, 15)[1]!
  assert.ok(fg >> 16 < 0xff && fg >> 16 > 0)
})

test('edges are drawn with braille sub-pixels', () => {
  const cells = rasterize(scene([], [{ x1: 0, y1: 300, x2: 800, y2: 300, weight: 1, depth: 1 }]), 80, 30)
  const row = Array.from({ length: 80 }, (_, c) => cell(cells, 80, c, 15)[0]!)
  assert.ok(row.filter((cp) => cp >= 0x2801 && cp <= 0x28ff).length >= 70)
})

test('cols and rows clamp to 1..512 and 1..256', () => {
  assert.equal(rasterize(busy, 2000, 900).length, 512 * 256 * 3)
  assert.equal(rasterize(busy, 0, -3).length, 3)
})

test('toBase64 matches a Buffer-based little-endian reference', () => {
  const words = Uint32Array.of(0x2588, 0xff8800, 0x01000000)
  assert.equal(toBase64(words), Buffer.from(words.buffer).toString('base64'))
  const many = rasterize(busy, 33, 7)
  assert.equal(toBase64(many), Buffer.from(many.buffer, many.byteOffset, many.byteLength).toString('base64'))
  assert.equal(DEFAULT_BG, 0x01000000)
})

// ---- v2-13: layered scene in the terminal ----
import { layeredFixture } from './helpers.ts'

/** East Asian Wide/Fullwidth ranges that matter below U+10000 (Unicode EastAsianWidth.txt, W/F). */
const WIDE: [number, number][] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe],
  [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be],
  [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755],
  [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6],
]
const printableNarrow = (cp: number) =>
  cp >= 0x20 && cp !== 0x7f && cp < 0x10000 && !(cp >= 0x80 && cp < 0xa0) && !(cp >= 0x300 && cp < 0x370) &&
  !(cp >= 0xd800 && cp < 0xe000) && !WIDE.some(([a, b]) => cp >= a && cp <= b)

test('v2-13: 80x24 layered raster shows each kind glyph present; evidence only as a dot', () => {
  const { scene, model } = layeredFixture()
  const cells = rasterize(scene, 80, 24)
  assert.equal(cells.length, 80 * 24 * 3)
  const cps = new Set<number>()
  for (let k = 0; k < cells.length; k += 3) {
    assert.ok(printableNarrow(cells[k]!), `cp ${cells[k]!.toString(16)}`)
    cps.add(cells[k]!)
  }
  const goalGlyph = printableNarrow(0x25ce) ? 0x25ce : 0x25cf
  const glyph: Record<string, number> = {
    goal: goalGlyph, component: 0x25cf, decision: 0x25a0, requirement: 0x25b2, constraint: 0x25c6, assumption: 0x25c7, dependency: 0x2b21, risk: 0x2715, question: 0x3f,
  }
  for (const k of new Set(Object.values(model.nodes).map((n) => n.kind))) assert.ok(cps.has(glyph[k]!), `${k} glyph ${glyph[k]!.toString(16)}`)
  // v1 node glyphs never appear: evidence is drawn as a dim middle dot only
  for (const v1 of [0x2588, 0x2022]) assert.ok(!cps.has(v1), `v1 glyph ${v1.toString(16)}`)
  assert.ok(cps.has(0xb7), 'evidence dots')
  // an evidence item that no solution glyph or label covers is a dot
  const ev = scene.items.filter((i) => i.layer === 'evidence')
  const dots = ev.filter((i) => { const c = Math.floor(i.x * 80 / scene.width), r = Math.floor(i.y * 24 / scene.height); return cells[(r * 80 + c) * 3] === 0xb7 })
  assert.ok(dots.length >= 5, `dots ${dots.length}`)
  const b64 = toBase64(cells)
  const back = new Uint32Array(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer)
  assert.deepEqual(back, cells)
})
