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
