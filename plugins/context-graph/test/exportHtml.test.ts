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
