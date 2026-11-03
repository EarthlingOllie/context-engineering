// mermaid: the classDiagram emitter (v3 design.md 4.6, feature v3-13).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mermaidName, sanitizeMember, toMermaid } from '../src/core/mermaid.ts'
import type { Diagram, DiagramElement, DiagramRelation } from '../src/core/diagram.ts'

const counts = () => ({ matching: 0, 'planned-not-built': 0, 'built-not-planned': 0, 'removed-but-built': 0, unchecked: 0, plannedMembers: 0,
  relations: { matching: 0, 'planned-not-built': 0, 'built-not-planned': 0, 'removed-but-built': 0, unchecked: 0 } })
const diagram = (elements: DiagramElement[], relations: DiagramRelation[] = []): Diagram =>
  ({ step: 1, steps: 1, current: null, elements, relations, counts: counts(), scan: null, hidden: 0 })
const E = (id: string, name: string, extra: Partial<DiagramElement> = {}): DiagramElement =>
  ({ id, name, kind: 'class', members: [], status: 'active', flag: null, change: null, decisions: [], source: 'intended', ...extra })
const R = (from: string, kind: DiagramRelation['kind'], to: string, extra: Partial<DiagramRelation> = {}): DiagramRelation =>
  ({ id: `${from}|${kind}|${to}`, from, to, kind, status: 'active', flag: null, change: null, source: 'intended', ...extra })
const op = (text: string, extra: Partial<DiagramElement['members'][number]> = {}) => ({ text, kind: 'operation' as const, removed: false, ...extra })

test('v3-13: header, class blocks, annotations, stereotype line and members', () => {
  const out = toMermaid(diagram([
    E('uml:svg-renderer', 'SvgRenderer', { kind: 'component', stereotype: 'pure', members: [op('+renderSvg(scene, o) string', { flag: 'matching' }), op('+old()', { removed: true }), op('+todo()', { flag: 'planned-not-built' })] }),
    E('uml:svg-options', 'SvgOptions', { kind: 'interface', members: [{ text: 'theme: Map<string, number>', kind: 'attribute', removed: false }] }),
    E('uml:base', 'Base', { stereotype: 'abstract' }),
    E('uml:plain', 'Plain'),
  ]))
  assert.ok(out.text.startsWith('classDiagram\n  direction LR\n'))
  assert.ok(out.text.includes([
    '  class E_svg_renderer["SvgRenderer"] {',
    '    <<component>>',
    '    «pure»',
    '    +renderSvg(scene, o) string',
    '    +todo() ◌',
    '  }',
  ].join('\n')), out.text)
  assert.ok(out.text.includes('  class E_svg_options["SvgOptions"] {\n    <<interface>>\n    theme: Map~string, number~\n  }'))
  assert.ok(out.text.includes('  class E_base["Base"] {\n    <<abstract>>\n  }'))
  assert.ok(out.text.includes('  class E_plain["Plain"] {\n  }'))
  assert.ok(!out.text.includes('old()'))
  assert.deepEqual(out.names, { 'uml:svg-renderer': 'E_svg_renderer', 'uml:svg-options': 'E_svg_options', 'uml:base': 'E_base', 'uml:plain': 'E_plain' })
})

test('v3-13: at most maxMembers members, then "…+n more"', () => {
  const members = Array.from({ length: 13 }, (_, i) => op(`m${i}()`))
  const out = toMermaid(diagram([E('uml:a', 'A', { members })]))
  assert.ok(out.text.includes('    m9()\n    …+3 more\n  }'))
  assert.ok(!out.text.includes('m10()'))
  assert.ok(toMermaid(diagram([E('uml:a', 'A', { members })]), { maxMembers: 2 }).text.includes('    m1()\n    …+11 more\n'))
})

test('v3-13: names are E_/B_ + [A-Za-z0-9_] with collision suffixes', () => {
  const taken = new Set<string>()
  assert.equal(mermaidName('uml:svg-renderer', taken), 'E_svg_renderer')
  assert.equal(mermaidName('uml:svg_renderer', taken), 'E_svg_renderer_2')
  assert.equal(mermaidName('uml:svg.renderer', taken), 'E_svg_renderer_3')
  assert.equal(mermaidName('code:core/prng.ts', taken), 'B_core_prng_ts')
  assert.equal(mermaidName('code:core/a.ts#Ünï', taken), 'B_core_a_ts__n_')
  assert.match(mermaidName('uml:callback-click', new Set()), /^E_[A-Za-z0-9_]+$/)
})

test('v3-13: arrows, labels, composition whole on the left and removed/planned suffixes', () => {
  const els = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => E(`uml:${x}`, x.toUpperCase()))
  const out = toMermaid(diagram(els, [
    R('uml:a', 'association', 'uml:b', { label: 'uses' }),
    R('uml:a', 'dependency', 'uml:c'),
    R('uml:b', 'realization', 'uml:d'),
    R('uml:e', 'composition', 'uml:f', { label: 'owns' }),
    R('uml:c', 'generalization', 'uml:b', { status: 'removed' }),
    R('uml:d', 'dependency', 'uml:e', { status: 'abandoned', label: 'x' }),
    R('uml:f', 'dependency', 'uml:a', { flag: 'planned-not-built' }),
  ]))
  const lines = out.text.split('\n')
  for (const l of [
    '  E_a --> E_b : uses', '  E_a ..> E_c', '  E_b ..|> E_d', '  E_e *-- E_f : owns',
    '  E_c --|> E_b : ✗', '  E_d ..> E_e : x ✗', '  E_f ..> E_a : ◌',
  ]) assert.ok(lines.includes(l), `${l}\n${out.text}`)
  assert.ok(lines.indexOf('  E_a --> E_b : uses') > lines.lastIndexOf('  }'), 'relations after all classes')
})

test('v3-13: classDef for every mark and exactly one cssClass per class by priority change > status > flag', () => {
  const out = toMermaid(diagram([
    E('uml:a', 'A', { change: 'added', status: 'removed', flag: 'matching' }),
    E('uml:b', 'B', { status: 'abandoned', flag: 'removed-but-built' }),
    E('uml:c', 'C', { flag: 'planned-not-built' }),
    E('uml:d', 'D', { flag: 'matching' }),
    E('uml:e', 'E', { change: 'changed' }),
    E('uml:f', 'F', { status: 'removed', change: 'removed' }),
    E('code:x.ts', 'x.ts', { flag: 'built-not-planned', source: 'actual' }),
    E('uml:g', 'G', { flag: 'removed-but-built' }),
    E('uml:h', 'H', { flag: 'matching' }),
  ]))
  for (const c of ['cgAdded', 'cgChanged', 'cgRemoved', 'cgAbandoned', 'cgPlanned', 'cgBuilt', 'cgStale', 'cgMatch']) {
    assert.match(out.text, new RegExp(`\\n  classDef ${c} stroke`))
  }
  const css = out.text.split('\n').filter((l) => l.startsWith('  cssClass '))
  const byClass = new Map<string, string[]>()
  for (const l of css) {
    const m = /^  cssClass "([^"]+)" (cg\w+)$/.exec(l)
    assert.ok(m, l)
    for (const n of m[1]!.split(',')) byClass.set(n, [...(byClass.get(n) ?? []), m[2]!])
  }
  assert.deepEqual(Object.fromEntries(byClass), {
    E_a: ['cgAdded'], E_b: ['cgAbandoned'], E_c: ['cgPlanned'], E_d: ['cgMatch'], E_e: ['cgChanged'], E_f: ['cgRemoved'],
    B_x_ts: ['cgBuilt'], E_g: ['cgStale'], E_h: ['cgMatch'],
  })
})

test('v3-13: sanitizeMember', () => {
  assert.equal(sanitizeMember('items: Map<string, List<number>>'), 'items: Map~string, List~number~~')
  assert.equal(sanitizeMember("theme: 'dark' | 'light'"), "theme: 'dark' / 'light'")
  assert.equal(sanitizeMember('a{b};"c"`d`%%e  \n  f'), 'abcde f')
})

test('v3-13: sanitizeMember breaks markdown autolinks (Mermaid renders them as "Unsupported markdown: link")', () => {
  const Z = '\u200B'
  assert.equal(sanitizeMember('three@0.170.0 in the browser'), `three@${Z}0.170.0 in the browser`)
  assert.equal(sanitizeMember('see https://cdn.example/x'), `see https:${Z}//cdn.example/x`)
  assert.equal(sanitizeMember('www.example.com'), `www${Z}.example.com`)
  assert.equal(sanitizeMember('a @ b'), 'a @ b')
})

const NASTY = ['Bad"Name{x}[y]', 'Line\nbreak %%{init: {"theme":"dark"}}%%', 'click E_a call alert()', '<script>alert(1)</script>', 'callback href javascript:x', 'a; b', '%%', '"']

test('v3-13: adversarial names, members and labels never reach the output raw', () => {
  const els = NASTY.map((n, i) => E(`uml:n${i}`, n, { stereotype: n, members: NASTY.map((m) => op(m)), kind: i % 2 ? 'interface' : 'component' }))
  els.push(E('code:click callback/href.ts', 'click', { source: 'actual', flag: 'built-not-planned' }))
  const rels = NASTY.map((n, i) => R(`uml:n${i}`, 'dependency', `uml:n${(i + 1) % NASTY.length}`, { label: n }))
  const out = toMermaid(diagram(els, rels), { maxMembers: 20 })
  const low = out.text.toLowerCase()
  for (const bad of ['%%{init', 'click ', 'callback', 'href', '<script', '</script']) assert.ok(!low.includes(bad), `${bad} in output`)
  // every user line stays inside its class block or relation line: no line starts a stray statement
  for (const l of out.text.trimEnd().split('\n')) {
    assert.match(l, /^(classDiagram|  direction LR|  class [EB]_\w+\["[^"\n]*"\] \{|    .*|  \}|  [EB]_\w+ (-->|\.\.>|\.\.\|>|\*--|--\|>) [EB]_\w+( : [^"]*)?|  classDef cg\w+ .*|  cssClass "[\w,]+" cg\w+|%% truncated)$/, l)
    assert.ok(!/[{}"]/.test(l.startsWith('    ') ? l : ''), `member line keeps no brace or quote: ${l}`)
  }
  assert.equal(Object.keys(out.names).length, els.length)
})

test('v3-13: deterministic, and maxChars drops members, then unplanned elements, then labels', () => {
  const els = Array.from({ length: 30 }, (_, i) => E(`uml:e${i}`, `Element${i}`, { members: Array.from({ length: 8 }, (_, k) => op(`+operation${k}(argument: number) string`)) }))
  for (let i = 0; i < 10; i++) els.push(E(`code:mod${i}.ts`, `mod${i}.ts`, { source: 'actual', flag: 'built-not-planned' }))
  const rels = Array.from({ length: 29 }, (_, i) => R(`uml:e${i}`, 'dependency', `uml:e${i + 1}`, { label: `a fairly long label ${i}` }))
  const d = diagram(els, rels)
  const full = toMermaid(d)
  assert.equal(full.text, toMermaid(d).text)
  assert.ok(!full.text.includes('%% truncated'))
  const noMembers = toMermaid(d, { maxChars: full.text.length - 1 })
  assert.ok(noMembers.text.endsWith('%% truncated'))
  assert.ok(!noMembers.text.includes('operation0') && noMembers.text.includes('B_mod0_ts') && noMembers.text.includes(': a fairly long label 0'))
  const noUnplanned = toMermaid(d, { maxChars: noMembers.text.length - 20 })
  assert.ok(!noUnplanned.text.includes('B_mod0_ts') && noUnplanned.text.includes(': a fairly long label 0'))
  assert.equal(noUnplanned.names['code:mod0.ts'], undefined)
  const noLabels = toMermaid(d, { maxChars: noUnplanned.text.length - 20 })
  assert.ok(!noLabels.text.includes('a fairly long label') && noLabels.text.includes('E_e0 ..> E_e1'))
  assert.ok(noLabels.text.endsWith('%% truncated'))
})

test('v3-13: an empty diagram is a valid header only', () => {
  assert.deepEqual(toMermaid(diagram([])), { text: 'classDiagram\n  direction LR\n', names: {} })
})
