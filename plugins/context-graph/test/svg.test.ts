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

test('the light theme darkens node fills so every kind colour keeps at least 3:1 contrast on white', () => {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
  }
  const kinds = [0x8a8f98, 0xf2b84b, 0x6ea8fe, 0x5ccf91, 0xc792ea, 0xef6f6c]
  const items = kinds.map((color, i) => item(`k${i}`, { color, weight: 1 }))
  const light = renderSvg(scene(items), { width: 400, height: 300, theme: 'light' })
  const fills = [...light.matchAll(/<circle cx="[^"]+" cy="[^"]+" r="[^"]+" fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]!)
  assert.equal(fills.length, kinds.length)
  for (const f of fills) assert.ok(1.05 / (lum(f) + 0.05) >= 3, `${f} on white`)
  const dark = renderSvg(scene([item('d', { weight: 1 })]), { width: 400, height: 300, theme: 'dark' })
  assert.match(dark, /fill="#5ccf91"/, 'the dark theme keeps the kind colour')
})

// ---- v2-11 / v2-12: layered scenes ----
import { layeredFixture } from './helpers.ts'

/** The balanced <g ...>...</g> element starting at index i. */
function element(svg: string, i: number): string {
  const re = /<(\/?)g[\s>]/g
  re.lastIndex = i
  let depth = 0, m: RegExpExecArray | null
  while ((m = re.exec(svg))) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return svg.slice(i, svg.indexOf('>', m.index) + 1)
  }
  throw new Error('unbalanced g')
}
const solutionGroups = (svg: string) => [...svg.matchAll(/<g class="s"/g)].map((m) => element(svg, m.index!))
const attr = (el: string, name: string) => el.match(new RegExp(`^<g[^>]* ${name}="([^"]*)"`))?.[1]

test('v2-11: one <g> per solution node with data-kind/data-status; status and health styling', () => {
  const { scene, model } = layeredFixture()
  const svg = renderSvg(scene, { width: 800, height: 600, theme: 'dark' })
  assertWellFormed(svg)
  const groups = solutionGroups(svg)
  assert.equal(groups.length, Object.keys(model.nodes).length)
  const by = Object.fromEntries(groups.map((el) => [attr(el, 'data-id'), el]))
  for (const n of Object.values(model.nodes)) {
    const el = by[n.id]!
    assert.ok(el, n.id)
    assert.equal(attr(el, 'data-kind'), n.kind)
    assert.equal(attr(el, 'data-status'), n.status)
  }
  const shapeOf = (el: string) => el.match(/<(?:path|circle|rect|polygon|text)[^>]* class="shape"[^>]*>/)![0]
  const open = shapeOf(by['question:do-panes-work-on-the-web']!)
  assert.match(open, /fill="none"/)
  assert.match(open, /stroke-dasharray="4 3"/)
  const resolved = shapeOf(by['risk:pane-always-dark']!)
  assert.doesNotMatch(resolved, /fill="none"/)
  assert.doesNotMatch(resolved, /stroke-dasharray/)
  for (const id of ['decision:webgl-in-pane', 'question:use-a-worker']) {
    const el = by[id]!
    assert.ok(Number(attr(el, 'opacity')) <= 0.2, `${id} opacity`)
    assert.match(el.slice(0, el.indexOf('>')), /line-through/)
  }
  const ring = (el: string) => el.match(/<circle[^>]* class="health [^"]*"[^>]*>/)![0]
  const inW = ring(by['constraint:no-webgl-in-panes']!)
  assert.match(inW, /class="health in-window"/)
  assert.doesNotMatch(inW, /dasharray/)
  // export page cites turn:m2 only; synthGraph has no compaction, so build compaction by hand below
  const never = by['dependency:three-js-maths']!
  assert.match(ring(never), /class="health never-loaded"/)
  assert.match(never, />·<\/text>/)
  assert.match(by['question:do-panes-work-on-the-web']!, /<animateTransform[^>]*type="scale"[^>]*from="0"[^>]*to="1"/)
  assert.doesNotMatch(by['goal:show-the-context-window-as-a-graph']!, /<animateTransform/)
  const header = svg.match(/<text class="header"[^>]*>(.*?)<\/text>/)![1]!
  assert.match(header, /Show the context window as a graph/)
  assert.match(header, /open question/)
  for (const el of groups) {
    const title = el.match(/<title>(.*?)<\/title>/)![1]!
    const id = attr(el, 'data-id')!
    const n = model.nodes[id]!
    assert.ok(title.includes(n.kind) && title.includes(n.status) && /in-window|compacted|never-loaded/.test(title), title)
  }
  assert.doesNotMatch(svg, /<script/i)
  assert.doesNotMatch(svg, / on[a-z]+=/i)
  const light = renderSvg(scene, { width: 800, height: 600, theme: 'light' })
  const bg = (s: string) => s.match(/<rect width="100%" height="100%" fill="([^"]+)"/)![1]
  assert.notEqual(bg(svg), bg(light))
})

test('v2-11: compacted evidence gives a dashed health ring', () => {
  const { scene } = layeredFixture()
  const it = scene.items.find((i) => i.id === 'component:pane')!
  const s2 = { ...scene, items: scene.items.map((i) => (i === it ? { ...i, health: 'compacted' as const } : i)) }
  const svg = renderSvg(s2, { width: 800, height: 600, theme: 'dark' })
  const el = solutionGroups(svg).find((e) => attr(e, 'data-id') === 'component:pane')!
  assert.match(el.match(/<circle[^>]* class="health [^"]*"[^>]*>/)![0], /class="health compacted"[^>]*stroke-dasharray/)
})

function bigLayered(): Scene {
  const items: SceneItem[] = []
  const edges: Scene['edges'] = []
  const kinds = ['component', 'decision', 'constraint', 'question', 'risk'] as const
  for (let i = 0; i < 200; i++) items.push(item(`${kinds[i % 5]}:node-${i}`, {
    kind: kinds[i % 5], layer: 'solution', shape: 'circle', status: i % 5 === 3 ? 'open' : 'active', health: 'in-window', labelled: i < 24,
    label: `Solution node number ${i}`, x: i < 24 ? 20 : 20 + (i * 37) % 760, y: i < 24 ? 30 + i * 20 : 30 + (i * 53) % 480, r: 6, weight: 0.12 + (i % 3) / 3, depth: 100 + i, color: 0x3b82e0,
  }))
  for (let i = 0; i < 300; i++) items.push(item(`turn:e${i}`, {
    kind: 'turn', layer: 'evidence', label: `evidence ${i} with a longer label`, x: i < 6 ? 760 : (i * 41) % 800, y: i < 6 ? 100 + i * 30 : (i * 29) % 600, r: 3,
    weight: (i % 10) / 10, depth: 400 + i, inWindow: i % 4 !== 0, labelled: i < 6, cited: i % 6 === 0,
  }))
  for (let i = 0; i < 300; i++) edges.push({ x1: (i * 41) % 800, y1: (i * 29) % 600, x2: ((i + 1) * 41) % 800, y2: ((i + 1) * 29) % 600, weight: i % 2 ? 0.1 : 0.5, depth: 400 + i, kind: 'evidence', layer: 'evidence', from: `turn:e${i}`, to: `turn:e${(i + 1) % 300}` })
  for (let i = 0; i < 200; i++) edges.push({ x1: 20 + (i * 37) % 760, y1: 30 + (i * 53) % 540, x2: 400, y2: 300, weight: 0.5, depth: 100 + i, kind: 'depends-on', layer: 'solution', from: `${kinds[i % 5]}:node-${i}`, to: 'component:node-0' })
  for (let i = 0; i < 100; i++) edges.push({ x1: 20 + (i * 37) % 760, y1: 30 + (i * 53) % 540, x2: (i * 6 * 41) % 800, y2: (i * 6 * 29) % 600, weight: 0.3, depth: 300, kind: 'supported-by', layer: 'solution', from: `${kinds[i % 5]}:node-${i}`, to: `turn:e${(i * 6) % 300}` })
  return { width: 800, height: 600, items, edges, legend: { tokensInRadius: 0, totalTokens: 0, nodes: 300, blastNodes: 0, solution: { goal: 'Big goal', components: 40, decisions: 40, openQuestions: 40, health: { inWindow: 200, compacted: 0, missing: 0 }, kinds: [...kinds] } } }
}
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
const census = (s: string) => ({
  evLabels: count(s, /<text class="label ev"/g),
  weakEv: count(s, /<line class="ev weak"/g),
  evNodes: count(s, /<circle class="ev"/g),
  citedEv: count(s, /<circle class="ev cited"/g),
  solLabels: count(s, /<text class="label sol"/g),
  sol: count(s, /class="s"/g),
})

test('v2-12: 200 solution + 300 evidence stays within 131072 and 20000; solution nodes survive', () => {
  const sc = bigLayered()
  for (const maxChars of [131072, 20000]) {
    const svg = renderSvg(sc, { width: 800, height: 600, theme: 'dark', maxChars })
    assert.ok(svg.length <= maxChars, `${svg.length} > ${maxChars}`)
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'))
    assertWellFormed(svg)
  }
  const small = census(renderSvg(sc, { width: 800, height: 600, theme: 'dark', maxChars: 20000 }))
  assert.equal(small.sol, 200)
  assert.equal(small.evLabels, 0)
})

test('v2-12: ladder drops evidence labels, then weak evidence edges, then uncited evidence, then solution detail', () => {
  const sc = bigLayered()
  const full = renderSvg(sc, { width: 800, height: 600, theme: 'dark', maxChars: 1e7 })
  const all = census(full)
  assert.deepEqual([all.evLabels, all.weakEv, all.evNodes, all.citedEv, all.solLabels, all.sol], [6, 150, 250, 50, 24, 200])
  const seen = { labelsOnly: false, weakGone: false, uncitedGone: false }
  for (let budget = full.length; budget >= 20000; budget -= 500) {
    const c = census(renderSvg(sc, { width: 800, height: 600, theme: 'dark', maxChars: budget }))
    if (c.weakEv < all.weakEv) assert.equal(c.evLabels, 0, `budget ${budget}: weak edges dropped before evidence labels`)
    if (c.evNodes < all.evNodes) assert.equal(c.weakEv, 0, `budget ${budget}: uncited evidence dropped before weak edges`)
    if (c.solLabels < all.solLabels || c.sol < all.sol) assert.equal(c.evNodes, 0, `budget ${budget}: solution detail dropped before uncited evidence`)
    if (c.evLabels === 0 && c.weakEv === all.weakEv && c.evNodes === all.evNodes) seen.labelsOnly = true
    if (c.weakEv === 0 && c.evNodes === all.evNodes) seen.weakGone = true
    if (c.evNodes === 0 && c.citedEv === all.citedEv && c.sol === all.sol && c.solLabels === all.solLabels) seen.uncitedGone = true
  }
  assert.deepEqual(seen, { labelsOnly: true, weakGone: true, uncitedGone: true })
})
