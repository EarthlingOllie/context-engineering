// Acceptance (features.json 'acceptance-session'): a real session's transcript plus a hand-authored solution seed.
// Imports the seed against buildGraph(transcript), asserts checks (1)-(5), health, relevance and SVG styling, then
// writes solution.svg, solution.html (Artifact fragment), solution.png (WebGL page), pane.svg and pane.png.
// usage: node scripts/acceptance-session.ts <seed.json> <transcript.jsonl> <outdir> [--three <three@0.170.0 package dir>]
// --three serves three.js from 127.0.0.1 where the egress policy blocks cdn.jsdelivr.net.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildGraph } from '../src/core/ingest.ts'
import { applyOps, emptyModel, parseSeed } from '../src/core/solution.ts'
import { blastRadius } from '../src/core/blast.ts'
import { relevance } from '../src/core/relevance.ts'
import { health } from '../src/core/health.ts'
import { layoutLayers } from '../src/core/layers.ts'
import { buildLayeredScene } from '../src/core/scene.ts'
import { renderSvg } from '../src/core/svg.ts'
import { EXPORT_TITLE, exportSolutionHtml } from '../src/core/exportHtml.ts'
import type { SolutionModel } from '../src/core/types.ts'
import { runPage } from './webgl-page.ts'

const argv = process.argv.slice(2)
const ti = argv.indexOf('--three')
const threeDir = ti >= 0 ? resolve(argv.splice(ti, 2)[1]!) : undefined
if (argv.length < 3) { console.error('usage: node scripts/acceptance-session.ts <seed.json> <transcript.jsonl> <outdir> [--three <dir>]'); process.exit(2) }
const [seedPath, transcriptPath, outArg] = argv.map((a) => resolve(a.replace(/^~(?=\/)/, process.env.HOME ?? '~'))) as [string, string, string]
mkdirSync(outArg, { recursive: true })
const out = (f: string) => resolve(outArg, f)

const fails: string[] = []
const check = (ok: boolean, what: string) => { if (!ok) fails.push(what) }

// ---------------------------------------------------------------- import
const graph = buildGraph(readFileSync(transcriptPath, 'utf8'))
const seed = parseSeed(readFileSync(seedPath, 'utf8'))
check(seed.errors.length === 0, `seed parse errors: ${seed.errors.join('; ')}`)
const applied = applyOps(emptyModel(), seed.ops, { isEvidence: (id) => Boolean(graph.nodes[id]) })
const failed = applied.results.filter((r) => !r.ok)
check(failed.length === 0, `failed ops: ${JSON.stringify(failed)}`)
const m: SolutionModel = applied.model
const dangling = m.edges.filter((e) => e.kind === 'supported-by' && !graph.nodes[e.to])
check(dangling.length === 0, `dangling evidence: ${dangling.map((e) => `${e.from}->${e.to}`).join(', ')}`)

// ---------------------------------------------------------------- checks (1)-(5)
const node = (id: string) => m.nodes[id]
const has = (from: string, kind: string, to: string) => m.edges.some((e) => e.from === from && e.kind === kind && e.to === to)
const C = 'constraint:pane-no-webgl'
check(m.goalId === 'goal:context-visualiser', `(1) goalId ${m.goalId}`)
check(/three\.js/.test(node('goal:context-visualiser')?.label ?? '') && /mod/.test(node('goal:context-visualiser')?.label ?? ''), '(1) goal label names three.js and mod')
check(/WebGL/.test(node(C)?.label ?? '') && /maths-only/.test(node(C)?.label ?? ''), '(2) constraint label names WebGL and maths-only')
for (const d of ['decision:svg-projection', 'decision:webgl-artifact-export']) {
  check(node(d)?.kind === 'decision', `(3) ${d} exists`)
  check(has(C, 'constrains', d), `(3) ${C} constrains ${d}`)
  check(m.edges.some((e) => e.kind === 'decided-by' && e.to === d && node(e.from)?.kind === 'component'), `(3) a component is decided-by ${d}`)
}
check(node('decision:webgl-in-pane')?.status === 'abandoned', '(3) decision:webgl-in-pane abandoned')
check(has('decision:webgl-in-pane', 'contradicts', C) || has(C, 'contradicts', 'decision:webgl-in-pane'), '(3) webgl-in-pane contradicts the constraint')
for (const [r, d] of [['risk:blast-three-turns', 'decision:turn-hops-free'], ['risk:pane-always-dark', 'decision:theme-from-config']] as const) {
  check(node(r)?.status === 'resolved', `(4) ${r} resolved`)
  check(has(r, 'decided-by', d), `(4) ${r} decided-by ${d}`)
}
const Q = 'question:claude-ai-mod-panes'
check(node(Q)?.status === 'open', '(5) open question')
const named = ['goal:context-visualiser', C, 'decision:svg-projection', 'decision:webgl-artifact-export', 'decision:webgl-in-pane', 'risk:blast-three-turns', 'risk:pane-always-dark', 'decision:turn-hops-free', 'decision:theme-from-config', Q]
const hl = health(m, graph)
for (const id of named) {
  check(m.edges.some((e) => e.from === id && e.kind === 'supported-by' && graph.nodes[e.to]), `${id} has evidence in the transcript graph`)
  check(hl.byNode[id]?.state === 'in-window', `${id} health ${hl.byNode[id]?.state}`)
}

// ---------------------------------------------------------------- relevance with the model focus on the open question
const focus = { seeds: [{ id: Q, source: 'model' as const }] }
const blast = blastRadius(graph, focus.seeds)
const rel = relevance(m, graph, focus, blast)
check(rel.touched.includes(Q), 'relevance: open question touched')
for (const b of ['decision:artifact-as-web-surface', 'component:mod-pane']) check(rel.bearing.includes(b), `relevance: ${b} bearing`)

// ---------------------------------------------------------------- layout, SVG, pane
const positions = layoutLayers(m, graph, { solution: {}, evidence: {} }, { seed: 1 })
const view = { yaw: 30, pitch: 20, distance: 0, fov: 50, zoom: 1 }
const input = { model: m, graph, positions, relevance: rel, health: hl, view, layers: 'both' as const, note: 'Does claude.ai web show mod panes?' }
const svgAt = (w: number, h: number, theme: 'dark' | 'light') => renderSvg(buildLayeredScene(input, { w, h }), { width: w, height: h, theme })
const svg = svgAt(1200, 900, 'dark')
writeFileSync(out('solution.svg'), svg)
const gOf = (id: string) => svg.match(new RegExp(`<g class="s" data-id="${id.replace(/[.:]/g, '\\$&')}"[^>]*>[^]*?</g></g></g>`))?.[0] ?? ''
const qg = gOf(Q)
check(/data-status="open"/.test(qg) && /fill="none"[^>]*stroke-dasharray/.test(qg), 'svg: open question dashed and hollow')
for (const r of ['risk:blast-three-turns', 'risk:pane-always-dark']) { const g = gOf(r); check(g !== '' && /data-status="resolved"/.test(g) && !/class="shape"[^>]*fill="none"/.test(g), `svg: ${r} solid`) }
const ab = gOf('decision:webgl-in-pane')
const abOp = Number(ab.match(/^<g [^>]*opacity="([\d.]+)"/)?.[1] ?? 1)
check(ab !== '' && abOp <= 0.2, `svg: abandoned decision faded (opacity ${abOp})`)
// the pane at a typical desktop width (120 columns x 8 px, 4:3), in the light theme
const paneSvg = svgAt(960, 720, 'light')
check((paneSvg.match(/<text class="label sol"/g) ?? []).length === Object.keys(m.nodes).length, 'pane: every solution node labelled')
// no label (solution or evidence) covers another node's marker (solution markers include the health ring)
const paneItems = buildLayeredScene(input, { w: 960, h: 720 }).items
for (const l of paneSvg.matchAll(/<text class="label (sol|ev)" x="([\d.-]+)" y="([\d.-]+)"[^>]*>([^<]*)<\/text>/g)) {
  const [, cls, x, y, raw] = l as unknown as [string, string, string, string, string]
  const text = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const b = { x: +x, y: +y - 10, w: text.length * 6.7, h: 13 }
  const stem = text.replace('…', '')
  const own = paneItems.find((n) => (n.layer === 'solution') === (cls === 'sol') && stem.length > 0 && n.label.startsWith(stem))
  const hit = paneItems.find((n) => n !== own && Math.hypot(Math.max(b.x, Math.min(n.x, b.x + b.w)) - n.x, Math.max(b.y, Math.min(n.y, b.y + b.h)) - n.y) < (n.layer === 'solution' ? n.r + 3.5 : n.r))
  check(!hit, `pane: label '${text}' covers ${hit?.id}`)
}
writeFileSync(out('pane.svg'), paneSvg)

// ---------------------------------------------------------------- Artifact page (v2-14 checks) and its screenshot
const exportInput = { model: m, graph, positions, relevance: rel, health: hl, blast }
const html = exportSolutionHtml(exportInput, { since: m.seq })
writeFileSync(out('solution.html'), html)
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'
check(html.startsWith(`<title>${EXPORT_TITLE}</title>`) && EXPORT_TITLE === 'Context Window Graph', 'html: title')
for (const tag of ['<!doctype', '<html', '<head', '<body']) check(!html.toLowerCase().includes(tag), `html: no ${tag}`)
for (const u of html.match(/https?:\/\/[^\s"'`)<>]*/g) ?? []) check(u.startsWith(CDN), `html: url ${u}`)
const data = html.match(/<script type="application\/json" id="cg-data">([^]*?)<\/script>/)?.[1] ?? ''
check(!data.includes('</') && JSON.parse(data).solution.length === Object.keys(m.nodes).length, 'html: data block')

const runs = await runPage((base) => exportSolutionHtml(exportInput, base ? { threeUrl: base, since: m.seq } : { since: m.seq }), [{ width: 1280, height: 800 }], () => out('solution.png'), threeDir, { interact: false })
for (const r of runs) {
  check(r.errors.length === 0, `page console errors: ${r.errors.join(' | ')}`)
  check(r.probe?.solutionNodes === Object.keys(m.nodes).length, `page solution nodes ${r.probe?.solutionNodes}`)
  check(r.probe?.openQuestions === 1, `page open questions ${r.probe?.openQuestions}`)
  check(r.probe?.solLabels === Object.keys(m.nodes).length, `page solution labels ${r.probe?.solLabels} of ${Object.keys(m.nodes).length}`)
  check(r.probe?.labelHits === 0, `page: ${r.probe?.labelHits} labels cover a node marker`)
}

// pane.png: headless Chrome screenshot of the pane SVG (virtual time lets the grow-in finish)
const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find((b) => { try { execFileSync('which', [b], { stdio: 'ignore' }); return true } catch { return false } })
if (chrome) {
  execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=2000', '--window-size=960,720', `--screenshot=${out('pane.png')}`, `file://${out('pane.svg')}`], { stdio: 'ignore' })
}
check(existsSync(out('pane.png')), 'pane.png written')

if (fails.length) { console.error('acceptance failed:\n' + fails.join('\n')); process.exit(1) }
console.log(`ok: ${Object.keys(m.nodes).length} solution nodes, ${m.edges.length} edges over ${Object.keys(graph.nodes).length} evidence nodes; touched ${rel.touched.join(',')}; bearing ${rel.bearing.join(',')}; health ${JSON.stringify(hl.totals)}; outputs in ${outArg}`)
