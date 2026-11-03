// Export smoke test (v2-15): render the solution fixture (test/fixtures/solution-small.json over a synthetic
// transcript) as the Artifact fragment, open it in headless chromium at 1280x800 and 390x844 and assert:
// a canvas, no console errors, window.__cg counts match the input, the layers button cycles
// both -> solution -> evidence -> both changing visible mesh counts, replay ends within 6 s, no horizontal
// scroll at 390px. Screenshots go to <outdir>/smoke-<w>x<h>.png.
// usage: node scripts/export-smoke.ts [outdir] [--three <extracted three@0.170.0 package dir>]
// --three serves three.js from 127.0.0.1 (use it where the egress policy blocks cdn.jsdelivr.net).
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { exportSolutionHtml } from '../src/core/exportHtml.ts'
import { layeredInputs } from '../test/helpers.ts'
import { runPage } from './webgl-page.ts'

const argv = process.argv.slice(2)
const ti = argv.indexOf('--three')
const threeDir = ti >= 0 ? resolve(argv.splice(ti, 2)[1]!) : undefined
const out = resolve(argv[0] ?? '.')
mkdirSync(out, { recursive: true })
const input = layeredInputs()
const fragment = (threeUrl?: string) => exportSolutionHtml(input, threeUrl ? { threeUrl } : {})
writeFileSync(resolve(out, 'smoke.html'), fragment())

const want = {
  solutionNodes: Object.keys(input.model.nodes).length,
  evidenceNodes: Object.keys(input.graph.nodes).length,
  openQuestions: Object.values(input.model.nodes).filter((n) => n.kind === 'question' && n.status === 'open').length,
}
const runs = await runPage(fragment, [{ width: 1280, height: 800 }, { width: 390, height: 844 }], (v) => resolve(out, `smoke-${v.width}x${v.height}.png`), threeDir)
const fails: string[] = []
for (const r of runs) {
  const at = `${r.viewport.width}x${r.viewport.height}`
  if (r.errors.length) fails.push(`${at} console errors: ${r.errors.join(' | ')}`)
  if (!r.probe) { fails.push(`${at} no __cg probe`); continue }
  for (const k of Object.keys(want) as (keyof typeof want)[]) if (r.probe[k] !== want[k]) fails.push(`${at} ${k} ${r.probe[k]} != ${want[k]}`)
  const seq = r.layersCycle.map((c) => c.layers).join('>')
  if (seq !== 'solution>evidence>both') fails.push(`${at} layers cycle ${seq}`)
  const counts = [r.probe.visibleMeshes, ...r.layersCycle.map((c) => c.visibleMeshes)]
  if (!(counts[1] === want.solutionNodes && counts[2] === want.evidenceNodes && counts[0] === counts[3] && counts[0] > counts[1]!)) fails.push(`${at} visible mesh counts ${counts.join(',')}`)
  if (!r.replay.started || r.replay.endedMs < 0 || r.replay.endedMs > 6000) fails.push(`${at} replay ${JSON.stringify(r.replay)}`)
  if (r.viewport.width === 390 && r.scrollWidth > 390) fails.push(`${at} scrollWidth ${r.scrollWidth}`)
}
if (fails.length) { console.error('smoke failed:\n' + fails.join('\n')); process.exit(1) }
console.log(`ok: ${runs.map((r) => `${r.viewport.width}x${r.viewport.height} ${JSON.stringify(r.probe)} replay ${r.replay.endedMs}ms scrollWidth ${r.scrollWidth}`).join('; ')}; screenshots in ${out}`)
