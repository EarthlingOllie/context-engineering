// Features 12-13: Scene -> SVG string: safe, depth-sorted, weight-dimmed, within the 131072-char budget.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderSvg } from '../src/core/svg.ts'
import type { Scene, SceneItem } from '../src/core/scene.ts'

const item = (id: string, over: Partial<SceneItem> = {}): SceneItem => ({
  id, kind: 'tool', label: id, tokens: 100, x: 100, y: 100, depth: 50, r: 6, weight: 0, inWindow: true, color: 0x5ccf91, ...over,
})
const scene = (items: SceneItem[], edges: Scene['edges'] = []): Scene => ({
  width: 400, height: 300, items, edges,
  legend: { tokensInRadius: 10, totalTokens: 100, nodes: items.length, blastNodes: 1 },
})

/** Minimal XML well-formedness check: balanced tags, no raw '<' or bare '&' in text or attributes. */
function assertWellFormed(xml: string) {
  const stack: string[] = []
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/gy
  let m: RegExpExecArray | null
  let pos = 0
  while ((m = re.exec(xml))) {
    pos = re.lastIndex
    const text = m[5] ?? m[3] ?? ''
    for (const amp of text.matchAll(/&/g)) assert.match(text.slice(amp.index), /^&(amp|lt|gt|quot|apos|#\d+);/, 'bare &')
    if (m[5] !== undefined) continue
    if (m[1]) assert.equal(stack.pop(), m[2], `unbalanced </${m[2]}>`)
    else if (!m[4]) stack.push(m[2]!)
  }
  assert.equal(pos, xml.length, `unparseable at ${pos}: ${xml.slice(pos, pos + 40)}`)
  assert.deepEqual(stack, [])
}
const tags = (svg: string) => svg.match(/<[^>]+>/g) ?? []

test('output is a well-formed svg with one title per node and no scripts or event handlers', () => {
  const s = scene([item('a'), item('b', { label: 'x <&"> y onclick=z', weight: 1, seed: 'prompt', hop: 0 })])
  const svg = renderSvg(s, { width: 400, height: 300, theme: 'dark' })
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'))
  assertWellFormed(svg)
  assert.equal(svg.match(/<title>/g)?.length, 2)
  assert.ok(!svg.toLowerCase().includes('<script'))
  for (const t of tags(svg)) assert.doesNotMatch(t, /\son[a-z]+\s*=/i)
  assert.ok(svg.includes('x &lt;&amp;&quot;&gt; y'))
})

test('nodes are painted far to near regardless of input order', () => {
  const s = scene([item('near', { depth: 10 }), item('far', { depth: 90 }), item('mid', { depth: 50 })])
  const svg = renderSvg(s, { width: 400, height: 300, theme: 'light' })
  const order = [...svg.matchAll(/<title>tool · (\w+)/g)].map((m) => m[1])
  assert.deepEqual(order, ['far', 'mid', 'near'])
})

test('weight-0 nodes are dim, seeds get a ring and model seeds a dashed one', () => {
  const s = scene([item('cold'), item('p', { weight: 1, seed: 'prompt' }), item('m', { weight: 1, seed: 'model' })])
  const svg = renderSvg(s, { width: 400, height: 300, theme: 'dark' })
  const group = (id: string) => svg.match(new RegExp(`<g class="n[^"]*" opacity="([\\d.]+)"><title>tool · ${id} [\\s\\S]*?</g>`))!
  assert.ok(Number(group('cold')[1]) <= 0.2)
  assert.match(group('p')[0], /class="ring"/)
  assert.doesNotMatch(group('p')[0], /stroke-dasharray/)
  assert.match(group('m')[0], /class="ring"[^>]*stroke-dasharray/)
  assert.doesNotMatch(group('cold')[0], /class="ring"/)
})

test('a small scene keeps its labels', () => {
  const svg = renderSvg(scene([item('alpha', { weight: 1 }), item('beta', { weight: 0.5 })]), { width: 400, height: 300, theme: 'dark' })
  assert.match(svg, /<text[^>]*class="label"[^>]*>alpha<\/text>/)
})

test('a huge scene degrades to <= 131072 chars and keeps every seed', () => {
  const items: SceneItem[] = []
  for (let i = 0; i < 2000; i++)
    items.push(item(`n${i}`, { label: `n${i} ` + 'L'.repeat(200), x: (i * 7) % 400, y: (i * 13) % 300, depth: i % 97, weight: (i % 10) / 10, inWindow: i % 3 !== 0, seed: i % 500 === 0 ? 'model' : undefined }))
  const edges = Array.from({ length: 5000 }, (_, i) => ({ x1: i % 400, y1: i % 300, x2: (i * 3) % 400, y2: (i * 5) % 300, weight: (i % 4) / 4, depth: i % 50 }))
  const svg = renderSvg(scene(items, edges), { width: 400, height: 300, theme: 'dark' })
  assert.ok(svg.length <= 131072, `${svg.length}`)
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'))
  assertWellFormed(svg)
  for (const i of [0, 500, 1000, 1500]) assert.ok(svg.includes(`<title>tool · n${i} `), `seed n${i} kept`)
})

test('maxChars below the fixed overhead still returns a closed svg', () => {
  const svg = renderSvg(scene([item('a', { seed: 'prompt', weight: 1 })]), { width: 400, height: 300, theme: 'dark', maxChars: 2000 })
  assert.ok(svg.length <= 2000 && svg.startsWith('<svg') && svg.endsWith('</svg>'))
})

test('every non-seed blast-radius node gets a visible halo; nodes outside the radius do not', () => {
  const svg = renderSvg(scene([
    item('seed', { weight: 1, seed: 'prompt' }), item('hop1', { x: 200, weight: 0.5, hop: 1 }), item('hop2', { x: 300, weight: 0.25, hop: 2 }), item('cold', { x: 50, y: 250, weight: 0 }),
  ]), { width: 400, height: 300, theme: 'dark' })
  const group = (id: string) => svg.match(new RegExp(`<g class="n[^"]*"[^>]*><title>tool · ${id} [^]*?</g>`))![0]
  assert.match(group('hop1'), /class="halo"/)
  assert.match(group('hop2'), /class="halo"/)
  assert.doesNotMatch(group('cold'), /class="halo"/)
})

test('labels never overlap one another', () => {
  const items = Array.from({ length: 8 }, (_, k) => item(`node-with-a-long-label-${k}`, { x: 100 + k * 3, y: 100 + k * 2, weight: 1 - k / 10 }))
  const svg = renderSvg(scene(items), { width: 400, height: 300, theme: 'dark' })
  const boxes = [...svg.matchAll(/<text class="label" x="([\d.-]+)" y="([\d.-]+)"[^>]*>([^<]*)<\/text>/g)]
    .map((m) => ({ x: +m[1]!, y: +m[2]! - 10, w: m[3]!.length * 6.6, h: 13 }))
  assert.ok(boxes.length >= 2)
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    const A = boxes[a]!, B = boxes[b]!
    const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h
    assert.ok(!overlap, `labels ${a} and ${b} overlap`)
  }
})
