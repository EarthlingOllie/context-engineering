// umlPane: layered box-and-arrow layout, SVG and terminal Raster over a Diagram (v3 design.md 4.7, v3-15..17).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyDesignOps, emptyUml, parseDesignSeed } from '../src/core/uml.ts'
import { emptyModel } from '../src/core/solution.ts'
import { buildDiagram } from '../src/core/diagram.ts'
import type { Diagram, DiagramElement, DiagramRelation } from '../src/core/diagram.ts'
import { layoutUml, renderUmlSvg, rasterUml, UML_COLORS } from '../src/core/umlPane.ts'
import type { UmlLayout } from '../src/core/umlPane.ts'
import { THEMES } from '../src/core/svg.ts'
import { toBase64, MAX_COLS, MAX_ROWS } from '../src/core/raster.ts'
import type { UmlFlag } from '../src/core/crossCheck.ts'
import type { UmlKind, UmlRelKind } from '../src/core/uml-types.ts'
import { bestMs } from './helpers.ts'

// ---- builders ----
const zeroCounts = () => ({ matching: 0, 'planned-not-built': 0, 'built-not-planned': 0, 'removed-but-built': 0, unchecked: 0 })
function E(id: string, o: Partial<DiagramElement> = {}): DiagramElement {
  return { id, name: id.replace(/^uml:/, ''), kind: 'class', members: [], status: 'active', flag: null, change: null, decisions: ['decision:d'], source: 'intended', ...o }
}
function R(from: string, kind: UmlRelKind, to: string, o: Partial<DiagramRelation> = {}): DiagramRelation {
  return { id: `${from}|${kind}|${to}`, from, to, kind, status: 'active', flag: null, change: null, source: 'intended', ...o }
}
function D(elements: DiagramElement[], relations: DiagramRelation[] = [], o: Partial<Diagram> = {}): Diagram {
  return { step: 1, steps: 1, current: null, decision: { id: 'decision:d', label: 'Decide', drivenBy: [] }, elements, relations,
    counts: { ...zeroCounts(), plannedMembers: 0, relations: zeroCounts() }, scan: null, hidden: 0, ...o }
}
const KINDS: UmlKind[] = ['component', 'class', 'interface']
const FLAGS: (UmlFlag | null)[] = [null, 'matching', 'planned-not-built', 'built-not-planned', 'removed-but-built', 'unchecked']
/** n elements in a deterministic web of dependencies (some cycles), with members and mixed flags/status. */
function big(n: number): Diagram {
  const els: DiagramElement[] = []
  for (let i = 0; i < n; i++) {
    els.push(E(`uml:e${i}`, {
      name: `Element${i}${i % 7 === 0 ? 'WithAVeryLongNameThatMustBeCut' : ''}`, kind: KINDS[i % 3]!,
      members: Array.from({ length: i % 6 }, (_, k) => ({ text: `+member${k}(arg: number): string`, kind: k % 2 ? 'operation' as const : 'attribute' as const, removed: false })),
      flag: FLAGS[i % FLAGS.length]!, status: i % 11 === 5 ? 'removed' : 'active', source: i % 13 === 12 ? 'actual' : 'intended',
    }))
  }
  const rels: DiagramRelation[] = []
  for (let i = 1; i < n; i++) {
    rels.push(R(`uml:e${i}`, 'dependency', `uml:e${(i * 7) % i === 0 ? i - 1 : (i * 7) % i}`))
    if (i % 5 === 0) rels.push(R(`uml:e${i - 1}`, 'composition', `uml:e${i}`))
    if (i % 9 === 0) rels.push(R(`uml:e${i - 3}`, 'association', `uml:e${i}`))
  }
  if (n > 3) rels.push(R('uml:e0', 'dependency', `uml:e${n - 1}`)) // closes a cycle
  return D(els, rels)
}
const SIZES = [{ w: 960, h: 720 }, { w: 480, h: 900 }, { w: 1600, h: 600 }]
const overlap = (A: { x: number; y: number; w: number; h: number }, B: typeof A) => A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h
const box = (l: UmlLayout, id: string) => l.boxes.find((b) => b.id === id)!

const fixture = () => {
  const seed = parseDesignSeed(readFileSync(new URL('./fixtures/uml-small.json', import.meta.url), 'utf8'))
  const { state } = applyDesignOps({ sol: emptyModel(), uml: emptyUml() }, seed.ops)
  return buildDiagram({ uml: state.uml, sol: state.sol })
}

// ---- v3-15 layoutUml ----
test('v3-15: dependents rank above what they depend on, a composition whole above its part, isolated boxes last', () => {
  const d = D([E('uml:a'), E('uml:b'), E('uml:c'), E('uml:w'), E('uml:p'), E('uml:i', { kind: 'interface' }), E('uml:lone')], [
    R('uml:a', 'dependency', 'uml:b'), R('uml:b', 'association', 'uml:c'), R('uml:a', 'dependency', 'uml:c'),
    R('uml:w', 'composition', 'uml:p'), R('uml:p', 'realization', 'uml:i'),
  ])
  const l = layoutUml(d, { w: 960, h: 720 })
  assert.equal(box(l, 'uml:a').rank, 0)
  assert.equal(box(l, 'uml:b').rank, 1)
  assert.equal(box(l, 'uml:c').rank, 2, 'longest path, not shortest')
  assert.ok(box(l, 'uml:w').rank < box(l, 'uml:p').rank)
  assert.ok(box(l, 'uml:p').rank < box(l, 'uml:i').rank)
  assert.equal(box(l, 'uml:lone').rank, Math.max(...l.boxes.map((b) => b.rank)))
  assert.ok(box(l, 'uml:a').y < box(l, 'uml:b').y && box(l, 'uml:b').y < box(l, 'uml:c').y)
})

test('v3-15: cycles terminate (DFS back edges reversed) and every relation gets an edge', () => {
  const d = D([E('uml:a'), E('uml:b'), E('uml:c')], [R('uml:a', 'dependency', 'uml:b'), R('uml:b', 'dependency', 'uml:c'), R('uml:c', 'dependency', 'uml:a'), R('uml:a', 'association', 'uml:a')])
  const l = layoutUml(d, { w: 960, h: 720 })
  assert.deepEqual(l.boxes.map((b) => b.rank).sort(), [0, 1, 2])
  assert.equal(l.edges.length, 4)
})

test('v3-15: box widths clamp to 80..220 px from charW, height from members', () => {
  const d = D([E('uml:s', { name: 'S' }), E('uml:l', { name: 'L'.repeat(200) }),
    E('uml:m', { name: 'Mid', members: [{ text: 'x'.repeat(20), kind: 'attribute', removed: false }, { text: '+go()', kind: 'operation', removed: false }] })])
  const l = layoutUml(d, { w: 4000, h: 4000 })
  assert.equal(l.scale, 1)
  assert.equal(box(l, 'uml:s').w, 80)
  assert.equal(box(l, 'uml:l').w, 220)
  assert.ok(box(l, 'uml:l').title.endsWith('…'))
  const m = box(l, 'uml:m')
  assert.equal(m.w, 20 * 6.6 + 16)
  assert.equal(m.h, (2 + 2) * 14 + 8)
  assert.deepEqual(m.members, ['x'.repeat(20), '+go()'])
  assert.equal(layoutUml(d, { w: 4000, h: 4000 }, { charW: 10 }).boxes.find((b) => b.id === 'uml:m')!.w, 216)
})

test('v3-15: no overlaps, finite coordinates inside the size, at 1/12/40/120 elements and three sizes', () => {
  for (const n of [1, 12, 40, 120]) for (const size of SIZES) {
    const l = layoutUml(big(n), size)
    assert.equal(l.w, size.w); assert.equal(l.h, size.h)
    for (const b of l.boxes) {
      for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Number.isFinite(v))
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= size.w + 1e-9 && b.y + b.h <= size.h + 1e-9, `${n} ${size.w}x${size.h} ${b.id} out of bounds`)
    }
    for (const e of l.edges) for (const [x, y] of e.points) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= size.w && y <= size.h)
    for (let a = 0; a < l.boxes.length; a++) for (let b = a + 1; b < l.boxes.length; b++)
      assert.ok(!overlap(l.boxes[a]!, l.boxes[b]!), `${n} ${size.w}x${size.h}: ${l.boxes[a]!.id} overlaps ${l.boxes[b]!.id}`)
  }
})

test('v3-15: when scale < 0.6 it drops members, then unplanned, then removed; intended active boxes stay', () => {
  const d = big(120)
  const l = layoutUml(d, { w: 480, h: 900 })
  assert.equal(l.dropped.members, true)
  assert.ok(l.boxes.every((b) => b.members.length === 0))
  const ids = new Set(l.boxes.map((b) => b.id))
  for (const e of d.elements) if (e.source === 'intended' && e.status === 'active') assert.ok(ids.has(e.id), `${e.id} dropped`)
  assert.equal(l.dropped.unplanned, d.elements.filter((e) => e.source === 'actual').length)
  if (l.dropped.removed) assert.equal(l.dropped.removed, d.elements.filter((e) => e.source === 'intended' && e.status !== 'active').length)
  for (const e of l.edges) assert.ok(ids.has(e.from) && ids.has(e.to))
  // roomy: nothing dropped
  const roomy = layoutUml(big(12), { w: 1600, h: 1200 })
  assert.deepEqual(roomy.dropped, { members: false, unplanned: 0, removed: 0 })
  assert.equal(roomy.boxes.length, 12)
})

test('v3-15: deterministic', () => {
  const d = big(40)
  assert.deepEqual(layoutUml(d, { w: 960, h: 720 }), layoutUml(structuredClone(d), { w: 960, h: 720 }))
})

test('v3-15: barycentre ordering removes a known crossing', () => {
  // input order A B over C D with A->D and B->C crosses once; the sweep uncrosses it
  const d = D([E('uml:A'), E('uml:B'), E('uml:C'), E('uml:D')], [R('uml:A', 'dependency', 'uml:D'), R('uml:B', 'dependency', 'uml:C')])
  const l = layoutUml(d, { w: 960, h: 720 })
  const cx = (id: string) => box(l, id).x + box(l, id).w / 2
  const crossings = (pos: (id: string) => number) => (Math.sign(pos('uml:A') - pos('uml:B')) !== Math.sign(pos('uml:D') - pos('uml:C')) ? 1 : 0)
  const inputOrder = (id: string) => ({ 'uml:A': 0, 'uml:B': 1, 'uml:C': 0, 'uml:D': 1 } as Record<string, number>)[id]!
  assert.equal(crossings(inputOrder), 1)
  assert.equal(crossings(cx), 0)
})

test('v3-15: 120 elements lay out in under 50 ms', () => {
  const d = big(120)
  const best = bestMs(() => layoutUml(d, { w: 960, h: 720 }))
  assert.ok(best < 50, `${best.toFixed(1)} ms`)
})

// ---- v3-16 renderUmlSvg ----
const svgOf = (d: Diagram, theme: 'dark' | 'light' = 'dark', size = { w: 960, h: 720 }) =>
  renderUmlSvg(layoutUml(d, size), d, { width: size.w, height: size.h, theme })

test('v3-16: safe output with escaped adversarial names, within the size cap at 120 elements', () => {
  const evil = '<script>alert(1)</script>" onload="x\' &amp;'
  const d = D([E('uml:x', { name: evil, members: [{ text: `<img onerror=alert(1)>`, kind: 'attribute', removed: false }] }), E('uml:y')],
    [R('uml:x', 'dependency', 'uml:y', { label: '"><g onclick="z' })], { decision: { id: 'decision:d', label: '<b onmouseover=1>', drivenBy: [] } })
  for (const theme of ['dark', 'light'] as const) {
    const s = svgOf(d, theme)
    assert.ok(s.startsWith('<svg'))
    assert.ok(!/<script/i.test(s))
    assert.ok(!/ on[a-z]+=/i.test(s), 'no event attributes')
    assert.ok(s.includes('&lt;script&gt;'))
  }
  const huge = svgOf(big(120))
  assert.ok(huge.startsWith('<svg') && huge.length <= 131072, String(huge.length))
})

test('v3-16: one uml-box group per laid-out box with data attributes', () => {
  const d = fixture()
  const l = layoutUml(d, { w: 960, h: 720 })
  const s = renderUmlSvg(l, d, { width: 960, height: 720, theme: 'dark' })
  const groups = [...s.matchAll(/<g class="uml-box" data-id="([^"]*)" data-kind="([^"]*)" data-flag="([^"]*)" data-status="([^"]*)" data-change="([^"]*)"/g)]
  assert.equal(groups.length, l.boxes.length)
  assert.deepEqual(groups.map((g) => g[1]).sort(), l.boxes.map((b) => b.id).sort())
})

test('v3-16: flag styles, status fading and change highlights', () => {
  const d = D([
    E('uml:m', { flag: 'matching' }), E('uml:p', { flag: 'planned-not-built' }), E('uml:b', { flag: 'built-not-planned', source: 'actual' }),
    E('uml:s', { flag: 'removed-but-built', status: 'removed', change: 'removed' }), E('uml:u', { flag: 'unchecked', change: 'added' }),
    E('uml:ab', { status: 'abandoned' }), E('uml:ch', { change: 'changed' }),
  ])
  const s = svgOf(d)
  const g = (id: string) => { const i = s.indexOf(`data-id="${id}"`); return s.slice(i, s.indexOf('</g>', i)) }
  assert.match(g('uml:m'), /data-flag="matching"/); assert.ok(g('uml:m').includes('✓')); assert.ok(!/class="frame"[^>]*stroke-dasharray/.test(g('uml:m')))
  assert.match(g('uml:p'), /stroke-dasharray="5 3"/); assert.ok(g('uml:p').includes('◌'))
  assert.match(g('uml:b'), /stroke-dasharray="1 3"/); assert.match(g('uml:b'), />\+</)
  assert.match(g('uml:s'), new RegExp(`stroke="${UML_COLORS.dark.flag['removed-but-built']}"`)); assert.match(g('uml:s'), />!</)
  assert.ok(!/class="badge"/.test(g('uml:u')), 'unchecked has no badge')
  for (const id of ['uml:s', 'uml:ab']) { assert.match(g(id), /opacity="0.45"/); assert.match(g(id), /line-through/) }
  assert.match(g('uml:u'), /<animate [^>]*dur="1.2s" repeatCount="2"/)
  assert.ok(!/<animate/.test(g('uml:ch'))); assert.match(g('uml:ch'), /class="hl"[^>]*stroke-dasharray/)
})

test('v3-16: markers for all five relation kinds, composition diamond at the whole; header and empty hint', () => {
  const d = D([E('uml:w', { kind: 'component' }), E('uml:p'), E('uml:i', { kind: 'interface' }), E('uml:q'), E('uml:r')], [
    R('uml:w', 'composition', 'uml:p'), R('uml:p', 'realization', 'uml:i'), R('uml:w', 'dependency', 'uml:q'),
    R('uml:q', 'association', 'uml:r'), R('uml:r', 'generalization', 'uml:p'), R('uml:q', 'dependency', 'uml:p', { status: 'removed' }),
  ], { step: 3, steps: 7, decision: { id: 'decision:d', label: 'Layered core', drivenBy: [] },
    counts: { matching: 1, 'planned-not-built': 2, 'built-not-planned': 3, 'removed-but-built': 4, unchecked: 5, plannedMembers: 0, relations: zeroCounts() } })
  const s = svgOf(d)
  const defs = s.slice(s.indexOf('<defs>'), s.indexOf('</defs>'))
  for (const k of ['association', 'dependency', 'realization', 'generalization', 'composition']) assert.ok(defs.includes(`id="m-${k}"`), k)
  assert.match(s, /<line [^>]*data-kind="composition"[^>]*marker-start="url\(#m-composition\)"/)
  assert.match(s, /<line [^>]*data-kind="dependency"[^>]*stroke-dasharray[^>]*marker-end="url\(#m-dependency\)"/)
  assert.match(s, /<line [^>]*data-status="removed"[^>]*opacity="0.35"/)
  assert.ok(s.includes('Step 3/7 · Layered core · ✓1 ◌2 +3 !4 ?5'))
  const empty = svgOf(D([], [], { step: 0, steps: 0, decision: undefined }))
  assert.ok(empty.includes('No UML yet: Claude records it with context_graph uml.add'))
  assert.ok(!empty.includes('uml-box'))
})

test('v3-16: themes use the v2 backgrounds; kind and flag colours keep 3:1 contrast on both', () => {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
  }
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05) }
  for (const theme of ['dark', 'light'] as const) {
    const bg = THEMES[theme].bg
    assert.ok(svgOf(D([E('uml:a')]), theme).includes(`fill="${bg}"`))
    const c = UML_COLORS[theme]
    for (const col of [...Object.values(c.kind), ...Object.values(c.flag), c.accent]) assert.ok(ratio(col, bg) >= 3, `${theme} ${col}`)
  }
})

// ---- v3-17 rasterUml ----
const BOX = new Set([...'┌─┐│└┘┄┆'].map((c) => c.codePointAt(0)!))
const textOf = (w: Uint32Array, cols: number, rows: number) => {
  const lines: string[] = []
  for (let r = 0; r < rows; r++) { let s = ''; for (let c = 0; c < cols; c++) s += String.fromCodePoint(w[(r * cols + c) * 3]!); lines.push(s) }
  return lines.join('\n')
}
const printableNarrow = (cp: number) => cp >= 0x20 && cp !== 0x7f && !(cp >= 0x80 && cp < 0xa0) && !(cp >= 0x300 && cp < 0x370) &&
  !(cp >= 0x1100 && cp <= 0x115f) && !(cp >= 0x2e80 && cp <= 0xa4cf) && !(cp >= 0xac00 && cp <= 0xd7a3) && !(cp >= 0xf900 && cp <= 0xfaff) &&
  !(cp >= 0xfe30 && cp <= 0xfe6f) && !(cp >= 0xff00 && cp <= 0xff60) && !(cp >= 0xffe0 && cp <= 0xffe6) && cp < 0x10000

test('v3-17: boxes, titles, edges with arrowheads, composition diamond and badges', () => {
  const d = D([E('uml:Top', { name: 'Top', flag: 'matching', kind: 'component' }), E('uml:Bottom', { name: 'BottomWithAVeryLongNameIndeed', flag: 'planned-not-built' }), E('uml:Part')],
    [R('uml:Top', 'dependency', 'uml:Bottom'), R('uml:Top', 'composition', 'uml:Part')])
  const l = layoutUml(d, { w: 960, h: 640 })
  const w = rasterUml(l, d, 120, 40, 'dark')
  assert.equal(w.length, 120 * 40 * 3)
  const t = textOf(w, 120, 40)
  for (const ch of '┌┐└┘│─') assert.ok(t.includes(ch), ch)
  assert.ok(t.includes('┄') || t.includes('┆'), 'planned-not-built box is dashed')
  assert.ok(t.includes('Top'))
  assert.ok(t.includes('…'), 'long title cut')
  assert.ok(t.includes('·'))
  assert.ok(/[▸◂▴▾]/.test(t), 'arrowhead')
  assert.ok(t.includes('◆'), 'composition whole')
  assert.ok(t.includes('✓') && t.includes('◌'), 'badges')
  const top = box(l, 'uml:Top')
  const sx = 120 / l.w, sy = 40 / l.h
  const rTop = Math.floor(top.y * sy), cRight = Math.floor((top.x + top.w) * sx) - 1
  const row = t.split('\n')[rTop]!
  assert.ok(row.slice(Math.max(0, cRight - 3), cRight + 1).includes('✓'), `badge near the top-right corner: ${row}`)
})

test('v3-17: printable single-width cells, clamps, base64 round-trip, degenerate inputs', () => {
  const evil = D([E('uml:x', { name: 'a\u0000b\u0007ćd中文\u{1F600}e\ttab' })])
  const lx = layoutUml(evil, { w: 400, h: 300 })
  for (const theme of ['dark', 'light'] as const) {
    const w = rasterUml(lx, evil, 80, 24, theme)
    for (let k = 0; k < w.length; k += 3) assert.ok(printableNarrow(w[k]!), `cp ${w[k]!.toString(16)}`)
  }
  const d = big(40), l = layoutUml(d, { w: 960, h: 720 })
  const w = rasterUml(l, d, 120, 40, 'light')
  for (let k = 0; k < w.length; k += 3) assert.ok(printableNarrow(w[k]!), `cp ${w[k]!.toString(16)}`)
  assert.equal(rasterUml(l, d, 5000, 5000, 'dark').length, MAX_COLS * MAX_ROWS * 3)
  const b64 = toBase64(w)
  const back = Buffer.from(b64, 'base64')
  assert.deepEqual(new Uint32Array(back.buffer, back.byteOffset, back.byteLength / 4), w)
  assert.equal(rasterUml(l, d, 1, 1, 'dark').length, 3)
  const e = D([]), le = layoutUml(e, { w: 100, h: 100 })
  assert.equal(rasterUml(le, e, 0, 0, 'dark').length, 3)
  assert.equal(rasterUml(le, e, 20, 10, 'dark').length, 600)
  assert.ok([...textOf(rasterUml(l, d, 120, 40, 'dark'), 120, 40)].some((ch) => BOX.has(ch.codePointAt(0)!)))
})
