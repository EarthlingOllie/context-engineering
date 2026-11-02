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
