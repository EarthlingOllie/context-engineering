// frame: the UML tab's default view frames the step's changes at a readable zoom (v3 readability fix).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frameView } from '../src/core/frame.ts'

const content = { w: 3000, h: 2000 }
const view = { w: 1000, h: 600 }
const o = { minZoom: 0.9, maxZoom: 1.25, pad: 20 }
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('frame: a small target is centred at the largest zoom', () => {
  const f = frameView([{ x: 1400, y: 900, w: 200, h: 100 }], content, view, o)
  assert.equal(f.zoom, 1.25)
  assert.equal(f.left, 1500 * 1.25 - 500)
  assert.equal(f.top, 950 * 1.25 - 300)
  assert.equal(f.framed, 1)
})

test('frame: boxes that fit only when zoomed out are fitted together, never below minZoom', () => {
  const f = frameView([{ x: 0, y: 0, w: 100, h: 100 }, { x: 960, y: 100, w: 100, h: 100 }], content, view, o)
  near(f.zoom, 960 / 1060)
  assert.equal(f.framed, 2)
})

test('frame: when all boxes do not fit at minZoom, the first box and the nearest others that fit are framed', () => {
  const first = { x: 2000, y: 1000, w: 200, h: 100 }
  const f = frameView([first, { x: 0, y: 0, w: 100, h: 100 }, { x: 2400, y: 1100, w: 100, h: 100 }], content, view, o)
  assert.equal(f.framed, 2)
  // the union of the first and the near one (x 2000..2500, y 1000..1200), centred at minZoom so the edges to the
  // boxes left out show as much as they can
  assert.equal(f.zoom, 0.9)
  assert.equal(f.left, 2250 * 0.9 - 500)
  assert.equal(f.top, 1100 * 0.9 - 300)
})

test('frame: a box taller or wider than the view shows its top-left corner, not its middle', () => {
  const f = frameView([{ x: 100, y: 200, w: 200, h: 1500 }], content, view, o)
  assert.equal(f.zoom, 0.9)
  assert.equal(f.top, 200 * 0.9 - 20)
  assert.equal(f.left, 0)
})

test('frame: scroll offsets stay inside the content; no boxes fits the whole diagram, never enlarged, not below minZoom', () => {
  const f = frameView([{ x: 0, y: 0, w: 10, h: 10 }], content, view, o)
  assert.deepEqual([f.left, f.top], [0, 0])
  const g = frameView([{ x: 2990, y: 1990, w: 10, h: 10 }], content, view, o)
  assert.deepEqual([g.left, g.top], [3000 * 1.25 - 1000, 2000 * 1.25 - 600])
  assert.deepEqual(frameView([], content, view, o), { zoom: 0.9, left: 0, top: 0, framed: 0 })
  assert.deepEqual(frameView([], { w: 500, h: 300 }, view, o), { zoom: 1, left: 0, top: 0, framed: 0 })
})

test('frame: a box that fits the view only without its padding is still centred', () => {
  const f = frameView([{ x: 1000, y: 500, w: 1100, h: 100 }], content, view, o)
  assert.equal(f.zoom, 0.9) // 990 px wide: inside the 1000 px view, not inside 1000 - 2 * 20
  assert.equal(f.left, 1550 * 0.9 - 500)
})
