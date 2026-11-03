// Feature 15: standalone three.js WebGL page with the graph embedded as data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportHtml } from '../src/core/exportHtml.ts'
import { blastRadius } from '../src/core/blast.ts'
import { layout } from '../src/core/layout.ts'
import { applyEvents } from '../src/core/ingest.ts'
import { synthGraph } from './helpers.ts'

const dataBlock = (html: string) => {
  const m = html.match(/<script type="application\/json" id="graph">([^]*?)<\/script>/)
  assert.ok(m, 'graph data block present')
  return m[1]!
}

test('the page imports three@0.170.0 and OrbitControls through an importmap', () => {
  const g = synthGraph(2, 3)
  const html = exportHtml(g, layout(g, {}, { seed: 1 }), blastRadius(g, []), { title: 'ctx' })
  assert.match(html, /^<!doctype html>/i)
  const map = JSON.parse(html.match(/<script type="importmap">([^]*?)<\/script>/)![1]!)
  assert.equal(map.imports.three, 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js')
  assert.equal(map.imports['three/addons/'], 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/')
  assert.match(html, /<script type="module">[^]*OrbitControls[^]*<\/script>/)
})

test('the embedded graph round-trips with the same node count, weights and positions', () => {
  const g = synthGraph(3, 4)
  const pos = layout(g, {}, { seed: 1 })
  const blast = blastRadius(g, [])
  const data = JSON.parse(dataBlock(exportHtml(g, pos, blast, { title: 't' })))
  assert.equal(data.nodes.length, Object.keys(g.nodes).length)
  assert.equal(data.edges.length, g.edges.length)
  const prompt = data.nodes.find((n: { id: string }) => n.id === g.latestPromptId)
  assert.equal(prompt.w, 1)
  assert.deepEqual(prompt.p, [pos[g.latestPromptId!]!.x, pos[g.latestPromptId!]!.y, pos[g.latestPromptId!]!.z])
})

test('labels containing </script> cannot break out of the data block, and the title is escaped', () => {
  const g = applyEvents(synthGraph(1, 1), [{ kind: 'prompt', id: 'evil', text: '</script><script>alert(1)</script> & <b>' }])
  const html = exportHtml(g, layout(g, {}, { seed: 1 }), blastRadius(g, []), { title: '<x> & "y"' })
  const block = dataBlock(html)
  assert.doesNotMatch(block, /<\/script/i)
  assert.equal(JSON.parse(block).nodes.length, Object.keys(g.nodes).length)
  assert.match(html, /<title>&lt;x&gt; &amp; &quot;y&quot;<\/title>/)
})

test('threeUrl overrides the CDN base', () => {
  const g = synthGraph(1, 1)
  const html = exportHtml(g, layout(g, {}, { seed: 1 }), blastRadius(g, []), { title: 't', threeUrl: 'https://example.test/three@0.170.0/' })
  assert.match(html, /"three":"https:\/\/example.test\/three@0.170.0\/build\/three.module.js"/)
})

// v2-14: the solution page meets the claude.ai Artifact contract.
import { exportSolutionHtml } from '../src/core/exportHtml.ts'
import { layeredInputs } from './helpers.ts'

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'

test('v2-14 default export is an Artifact-safe fragment titled Context Window Graph', () => {
  const html = exportSolutionHtml(layeredInputs())
  assert.ok(html.startsWith('<title>Context Window Graph</title>'), html.slice(0, 80))
  for (const tag of ['<!doctype', '<html', '<head', '<body']) assert.equal(html.toLowerCase().includes(tag), false, tag)
  const urls = html.match(/https?:\/\/[^\s"'`)<>]*/g) ?? []
  assert.ok(urls.length >= 2)
  for (const u of urls) assert.ok(u.startsWith(CDN), u)
  const map = JSON.parse(html.match(/<script type="importmap">([^]*?)<\/script>/)![1]!)
  assert.equal(map.imports.three, CDN + 'build/three.module.js')
  assert.equal(map.imports['three/addons/'], CDN + 'examples/jsm/')
})

test('v2-14 embedded JSON cannot close its script and carries every solution node', () => {
  const input = layeredInputs()
  const evil = { ...input, model: { ...input.model, nodes: { ...input.model.nodes, 'risk:x': { id: 'risk:x', kind: 'risk' as const, label: '</script><script>alert(1)</script>', status: 'open' as const, createdSeq: 1, updatedSeq: 1 } } } }
  const html = exportSolutionHtml(evil)
  const m = html.match(/<script type="application\/json" id="cg-data">([^]*?)<\/script>/)
  assert.ok(m, 'data block')
  assert.equal(m[1]!.includes('</'), false)
  const data = JSON.parse(m[1]!)
  assert.equal(data.solution.length, Object.keys(evil.model.nodes).length)
  assert.equal(data.evidence.length, Object.keys(input.graph.nodes).length)
})

test('v2-14 CSS uses :root tokens with both dark-mode guards and an explicit body background', () => {
  const css = exportSolutionHtml(layeredInputs()).match(/<style>([^]*?)<\/style>/)![1]!
  assert.match(css, /:root\s*\{[^}]*--bg:/)
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*--bg:/)
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[^}]*--bg:/)
  assert.match(css, /body\s*\{[^}]*background:\s*var\(--bg\)/)
})

test('v2-14 document:true wraps the same fragment in exactly one html/head/body', () => {
  const html = exportSolutionHtml(layeredInputs(), { document: true })
  assert.ok(html.startsWith('<!doctype html>'))
  for (const tag of ['<html', '<head', '<body']) assert.equal(html.split(tag).length - 1, 1, tag)
  assert.match(html, /<title>Context Window Graph<\/title>/)
})

test('v2-19: the page grows in exactly the nodes created after `since` (default: the model promptSeq)', () => {
  const cgData = (html: string) => JSON.parse(html.match(/<script type="application\/json" id="cg-data">([^]*?)<\/script>/)![1]!) as { since: number; solution: { id: string; c: number }[] }
  const fresh = (d: ReturnType<typeof cgData>) => d.solution.filter((n) => n.c > d.since).map((n) => n.id).sort()
  // solution-small.json: promptSeq 12, the two questions are adds 13 and 14
  const byDefault = cgData(exportSolutionHtml(layeredInputs()))
  assert.equal(byDefault.since, 12)
  assert.deepEqual(fresh(byDefault), ['question:do-panes-work-on-the-web', 'question:use-a-worker'])
  const all = cgData(exportSolutionHtml(layeredInputs(), { since: 0 }))
  assert.equal(fresh(all).length, all.solution.length)
  assert.match(exportSolutionHtml(layeredInputs()), /n\.c > D\.since/)
})

// v3-18: the Artifact page gains the UML tab (v3 design.md 4.8).
import { MERMAID_URL } from '../src/core/exportHtml.ts'
import { applyDesignOps, emptyUml, parseDesignSeed } from '../src/core/uml.ts'
import { emptyModel } from '../src/core/solution.ts'
import { assemble, scanFile } from '../src/core/codeScan.ts'
import { umlPageData } from '../src/core/diagram.ts'
import { timeline } from '../src/core/timeline.ts'
import { readFileSync } from 'node:fs'

const umlFixture = (extra: object[] = []) => {
  const seed = parseDesignSeed(readFileSync(new URL('./fixtures/uml-small.json', import.meta.url), 'utf8'))
  const ops = [...seed.ops, ...(parseDesignSeed(JSON.stringify({ format: 'context-graph/solution@2', ops: extra })).ops)]
  const { sol, uml } = applyDesignOps({ sol: emptyModel(), uml: emptyUml() }, ops).state
  const src: Record<string, string> = {
    'core/render.ts': 'export interface Options { theme: string }\nexport function render(s: unknown): string { return "" }',
    'core/gl.ts': 'export class GlRenderer { frame(): void {} }',
    'util/prng.ts': 'export function mulberry() {}',
  }
  const actual = assemble(Object.keys(src).map((p) => scanFile(p, src[p]!)), '/repo/src')
  return { sol, uml, page: umlPageData(uml, sol, actual, { scannedAt: 0 }) }
}
const withUml = (extra: object[] = []) => ({ ...layeredInputs(), uml: umlFixture(extra).page })
const modules = (html: string) => [...html.matchAll(/<script type="module">([^]*?)<\/script>/g)].map((m) => m[1]!)
const umlJson = (html: string) => {
  const m = html.match(/<script type="application\/json" id="cg-uml">([^]*?)<\/script>/)
  assert.ok(m, 'cg-uml data block')
  return m[1]!
}

test('v3-18: with uml the page keeps the Artifact contract; remote URLs are three@0.170.0/ or exactly MERMAID_URL', () => {
  const html = exportSolutionHtml(withUml())
  assert.ok(html.startsWith('<title>Context Window Graph</title>'), html.slice(0, 80))
  for (const tag of ['<!doctype', '<html', '<head', '<body']) assert.equal(html.toLowerCase().includes(tag), false, tag)
  const urls = html.match(/https?:\/\/[^\s"'`)<>\\]*/g) ?? []
  assert.ok(urls.includes(MERMAID_URL))
  assert.equal(MERMAID_URL, 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs')
  for (const u of urls) assert.ok(u.startsWith(CDN) || u === MERMAID_URL, u)
  const css = html.match(/<style>([^]*?)<\/style>/)![1]!
  assert.match(css, /:root\s*\{[^}]*--bg:/)
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*--bg:/)
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[^}]*--bg:/)
  assert.match(css, /body\s*\{[^}]*background:\s*var\(--bg\)/)
})

test('v3-18: a tab bar with UML design first, and a step range 1..steps', () => {
  const { page, uml, sol } = umlFixture()
  const html = exportSolutionHtml({ ...layeredInputs(), uml: page })
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])
  assert.deepEqual(tabs, ['UML design', '3D solution map'])
  assert.match(html, /<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>UML design</)
  const range = html.match(/<input type="range"[^>]*>/)
  assert.ok(range, 'range input')
  const steps = timeline(uml, sol).length
  assert.equal(steps, 5)
  assert.match(range[0], /\bmin="1"/)
  assert.match(range[0], new RegExp(`\\bmax="${steps}"`))
  assert.match(html, /<select[^>]*id="cg-unplanned"/)
  for (const id of ['cg-prev', 'cg-next', 'cg-play', 'cg-caption', 'cg-chips', 'uml', 'cg-side', 'cg-counts']) assert.match(html, new RegExp(`id="${id}"`), id)
  // tab: '3d' opens on the 3D tab
  assert.match(exportSolutionHtml({ ...layeredInputs(), uml: page }, { tab: '3d' }), /<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>3D solution map</)
})

test('v3-18: two separate module scripts; mermaid is imported only in one, three only in the other', () => {
  const html = exportSolutionHtml(withUml())
  const mods = modules(html)
  assert.equal(mods.length, 2)
  const um = mods.filter((s) => s.includes('mermaid'))
  const th = mods.filter((s) => /from 'three'/.test(s))
  assert.equal(um.length, 1)
  assert.equal(th.length, 1)
  assert.notEqual(um[0], th[0])
  assert.ok(um[0]!.includes(MERMAID_URL) && /import\(/.test(um[0]!))
  assert.equal(/from 'three'/.test(um[0]!), false)
  assert.equal(th[0]!.includes('mermaid'), false)
  const over = exportSolutionHtml(withUml(), { mermaidUrl: 'http://127.0.0.1:9/mermaid.esm.min.mjs' })
  assert.equal(over.includes(MERMAID_URL), false)
  assert.ok(over.includes('http://127.0.0.1:9/mermaid.esm.min.mjs'))
})

test('v3-18: the UML JSON cannot close its script, has one step per timeline step and both static fallback SVGs', () => {
  const evil = [
    { op: 'add', kind: 'decision', id: 'decision:evil', label: '</script><script>alert(1)</script>' },
    { op: 'uml.add', decision: 'decision:evil', kind: 'class', name: '</script><b>x', attributes: ['y: </style>'] },
  ]
  const { page, uml, sol } = umlFixture(evil)
  const html = exportSolutionHtml({ ...layeredInputs(), uml: page })
  const block = umlJson(html)
  assert.equal(block.includes('</'), false)
  const d = JSON.parse(block)
  assert.equal(d.steps.length, timeline(uml, sol).length)
  assert.equal(d.steps.length, 6)
  for (const theme of ['dark', 'light']) {
    assert.ok(d.static[theme].startsWith('<svg'), theme)
    assert.ok(d.static[theme].includes('uml-box'), theme)
  }
  assert.notEqual(d.static.dark, d.static.light)
  assert.equal(d.steps[5].mermaid, page.steps[5]!.mermaid)
  assert.ok(d.latest.components && d.latest.all && d.latest.none)
})

test('v3-18: without uml the v2 page is unchanged apart from the tab bar and an empty-state UML tab', () => {
  const v2 = exportSolutionHtml(layeredInputs())
  const v3 = exportSolutionHtml(withUml())
  const cg = (h: string) => h.match(/<script type="application\/json" id="cg-data">([^]*?)<\/script>/)![1]
  assert.equal(cg(v2), cg(v3))
  assert.equal(v2.includes('mermaid@'), false)
  assert.match(v2, /No UML yet/)
  assert.match(v2, /role="tab"[^>]*>UML design</)
  assert.deepEqual(JSON.parse(umlJson(v2)).steps, [])
  // the 3D module is the v2 solution client
  assert.ok(modules(v2).some((s) => s.includes("document.getElementById('cg-data')")))
})
