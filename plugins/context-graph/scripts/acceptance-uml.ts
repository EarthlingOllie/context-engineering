// Acceptance for v3 (features.json 'acceptance-session' and the browser half of v3-19, design.md section 6):
// this session's design seed as an emerging UML diagram, cross-checked against the plugin's own source.
// usage: node scripts/acceptance-uml.ts <seed.json> <transcript.jsonl> <srcRoot> <outdir>
//          [--three <three@0.170.0 package dir>] [--mermaid <mermaid@11.4.1 package dir>] [--baseline <git-rev>]
// --three / --mermaid serve those packages from 127.0.0.1 (the egress policy may block cdn.jsdelivr.net).
// Exits non-zero and lists every failed check.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, normalize, relative, resolve, sep } from 'node:path'
import { buildGraph } from '../src/core/ingest.ts'
import { applyDesignOps, emptyUml, parseDesignSeed } from '../src/core/uml.ts'
import { emptyModel } from '../src/core/solution.ts'
import { snapshotAt, timeline } from '../src/core/timeline.ts'
import { assemble, collectSources } from '../src/core/codeScan.ts'
import type { ActualDesign, SourceFs } from '../src/core/codeScan.ts'
import { crossCheck, UML_FLAGS } from '../src/core/crossCheck.ts'
import type { CrossCheck } from '../src/core/crossCheck.ts'
import { umlPageData } from '../src/core/diagram.ts'
import type { UmlVariant } from '../src/core/diagram.ts'
import { layoutUml, rasterUml, renderUmlSvg } from '../src/core/umlPane.ts'
import { blastRadius } from '../src/core/blast.ts'
import { relevance } from '../src/core/relevance.ts'
import { health } from '../src/core/health.ts'
import { layoutLayers } from '../src/core/layers.ts'
import { EXPORT_TITLE, exportSolutionHtml, MERMAID_URL, THREE_CDN } from '../src/core/exportHtml.ts'
import { wrap } from './webgl-page.ts'

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2)
const opt = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv.splice(i, 2)[1] : undefined }
const home = (a: string) => resolve(a.replace(/^~(?=\/)/, process.env.HOME ?? '~'))
const threeOpt = opt('--three'), mermaidOpt = opt('--mermaid'), baseline = opt('--baseline')
if (argv.length < 4) {
  console.error('usage: node scripts/acceptance-uml.ts <seed.json> <transcript.jsonl> <srcRoot> <outdir> [--three <dir>] [--mermaid <dir>] [--baseline <rev>]')
  process.exit(2)
}
const [seedPath, transcriptPath, srcRoot, outDir] = argv.map(home) as [string, string, string, string]
const threeDir = threeOpt ? home(threeOpt) : undefined
const mermaidDir = mermaidOpt ? home(mermaidOpt) : undefined
mkdirSync(join(outDir, 'steps'), { recursive: true })
const out = (f: string) => join(outDir, f)

const fails: string[] = []
const notes: string[] = []
const check = (ok: boolean, what: string) => { if (!ok) fails.push(what) }
const sameSet = (a: Iterable<string>, b: Iterable<string>) => { const x = [...new Set(a)].sort(), y = [...new Set(b)].sort(); return JSON.stringify(x) === JSON.stringify(y) }
const superset = (a: Iterable<string>, b: string[]) => { const s = new Set(a); return b.every((x) => s.has(x)) }

// ---------------------------------------------------------------- (1) seed
const graph = buildGraph(readFileSync(transcriptPath, 'utf8'))
const seed = parseDesignSeed(readFileSync(seedPath, 'utf8'))
check(seed.errors.length === 0, `(1) seed parse errors: ${seed.errors.join('; ')}`)
const applied = applyDesignOps({ sol: emptyModel(), uml: emptyUml() }, seed.ops, { isEvidence: (id) => Boolean(graph.nodes[id]) })
const failed = applied.results.filter((r) => !r.ok)
check(failed.length === 0, `(1) failed ops: ${JSON.stringify(failed).slice(0, 400)}`)
const { sol, uml } = applied.state
const dangling = sol.edges.filter((e) => e.kind === 'supported-by' && !graph.nodes[e.to])
check(dangling.length === 0, `(1) dangling evidence: ${dangling.map((e) => `${e.from}->${e.to}`).join(', ')}`)
check(Object.keys(sol.nodes).length === 24, `(1) solution nodes ${Object.keys(sol.nodes).length} != 24`)
check(Object.keys(uml.elements).length === 33, `(1) UML elements ${Object.keys(uml.elements).length} != 33`)

// ---------------------------------------------------------------- (2) timeline
const steps = timeline(uml, sol)
const N = steps.length
const ORDER = ['webgl-in-pane', 'webgl-in-pane', 'svg-projection', 'webgl-artifact-export', 'turn-hops-free', 'theme-from-config', 'solution-map-layer', 'uml-view', 'mermaid-in-artifact', 'pane-box-svg'].map((d) => `decision:${d}`)
check(N === 10, `(2) timeline has ${N} steps, not 10`)
check(JSON.stringify(steps.map((s) => s.decision)) === JSON.stringify(ORDER), `(2) decisions ${steps.map((s) => s.decision).join(',')}`)
check(steps.map((s) => s.abandoned).join() === ORDER.map((_, i) => i === 1).join(), `(2) abandoned flags ${steps.map((s) => s.abandoned).join()}`)
const ch = (k: number) => steps[k - 1]?.changes ?? { added: [], changed: [], removed: [] }
const W = 'uml:pane-webgl-renderer', T = 'uml:three-full'
check(superset(ch(1).added, [W, T]), `(2) step 1 added ${ch(1).added.join(',')}`)
const rm2 = ch(2).removed
check(rm2.length === 3 && superset(rm2, [W, T]) && rm2.some((r) => r.includes('|dependency|') && r.includes(W) && r.includes(T)), `(2) step 2 removed ${rm2.join(',')}`)
check(sameSet(ch(5).changed, ['uml:blast-radius']), `(2) step 5 changed ${ch(5).changed.join(',')}`)
check(superset(ch(6).added, ['uml:svg-options', 'uml:svg-renderer|composition|uml:svg-options']), `(2) step 6 added ${ch(6).added.join(',')}`)
check(superset(ch(7).changed, ['uml:live-ingest', 'uml:artifact-export']), `(2) step 7 changed ${ch(7).changed.join(',')}`)

// ---------------------------------------------------------------- (3) scan
const nodeFs = (root: string): SourceFs => ({
  list: async (d) => readdirSync(join(root, d)).map((name) => {
    const st = statSync(join(root, d, name))
    return { name, kind: st.isDirectory() ? 'directory' as const : st.isFile() ? 'file' as const : 'other' as const, size: st.size, mtimeMs: st.mtimeMs }
  }),
  read: async (f) => readFileSync(join(root, f), 'utf8'),
})
async function scan(root: string): Promise<ActualDesign> {
  const col = await collectSources('', nodeFs(root))
  const a = assemble(Object.values(col.files).map((f) => f.scan), root)
  return { ...a, skipped: col.skipped, truncated: col.truncated }
}
const actual = await scan(srcRoot)
const ex = actual.modules['core/exportHtml.ts']
check(Boolean(ex) && superset(ex!.deps, ['core/scene.ts', 'core/svg.ts']), `(3) core/exportHtml.ts deps ${ex?.deps.join(',')}`)
check(Boolean(ex) && ex!.externals.length === 0, `(3) core/exportHtml.ts externals ${ex?.externals.join(',')}`)
const cam = actual.modules['core/camera.ts']
check(Boolean(cam) && (cam!.outside[0] ?? '').startsWith('../vendor/three-math'), `(3) core/camera.ts outside ${cam?.outside.join(',')}`)

// ---------------------------------------------------------------- (4) cross-check at the latest step
const latest = snapshotAt(uml, N)
const cc = crossCheck(latest, actual)
const flagOf = (id: string) => cc.elements[id]?.flag
const UNCHECKED = ['uml:mod-shell', 'uml:context-graph-tool', 'uml:three-cdn', 'uml:mermaid-cdn']
const V3 = ['uml:uml-model', 'uml:uml-reducer', 'uml:decision-timeline', 'uml:code-scanner', 'uml:source-fs', 'uml:cross-check', 'uml:diagram-builder', 'uml:mermaid-emitter', 'uml:uml-pane']
check(sameSet(Object.keys(cc.elements).filter((id) => flagOf(id) === 'unchecked'), UNCHECKED), `(4) unchecked ${Object.keys(cc.elements).filter((id) => flagOf(id) === 'unchecked').join(',')}`)
for (const id of [W, T]) check(flagOf(id) === null && latest.elements[id]?.status === 'removed', `(4) ${id} flag ${flagOf(id)} status ${latest.elements[id]?.status}`)
for (const [id, e] of Object.entries(latest.elements)) {
  if (e.status !== 'active' || UNCHECKED.includes(id)) continue
  check(flagOf(id) === 'matching', `(4) ${id} is ${flagOf(id)}, not matching`)
}
for (const id of [...V3, 'uml:three-math']) check(flagOf(id) === 'matching', `(4) ${id} ${flagOf(id)}`)
check(cc.elements['uml:live-ingest']?.members.matchSolution === 'planned-not-built', `(4) live-ingest matchSolution ${cc.elements['uml:live-ingest']?.members.matchSolution}`)
check(superset(cc.unplanned.modules, ['core/prng.ts', 'core/tokens.ts']), `(4) built-not-planned modules ${cc.unplanned.modules.join(',')}`)
notes.push(`built-not-planned modules: ${cc.unplanned.modules.join(', ')}`)
const checkedEnd = (id: string) => { const f = flagOf(id); return f !== undefined && f !== null && f !== 'unchecked' }
for (const [id, r] of Object.entries(latest.relations)) {
  if (r.status !== 'active' || !checkedEnd(r.from) || !checkedEnd(r.to)) continue
  check(cc.relations[id] === 'matching', `(4) relation ${id} ${cc.relations[id]}`)
}

// ---------------------------------------------------------------- (5) baseline
let baseCc: CrossCheck | null = null
if (baseline) {
  const top = execFileSync('git', ['-C', srcRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const rel = relative(top, srcRoot)
  const tmp = mkdtempSync(join(tmpdir(), 'cg-baseline-'))
  try {
    const tar = execFileSync('git', ['-C', top, 'archive', '--format=tar', baseline, rel], { maxBuffer: 256 << 20 })
    execFileSync('tar', ['-x', '-C', tmp], { input: tar })
    baseCc = crossCheck(latest, await scan(join(tmp, rel)))
    const pnb = Object.keys(baseCc.elements).filter((id) => baseCc!.elements[id]!.flag === 'planned-not-built')
    check(sameSet(pnb, V3), `(5) baseline ${baseline} planned-not-built ${pnb.join(',')}`)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
}

// ---------------------------------------------------------------- (6) outputs
const page = umlPageData(uml, sol, actual, { scannedAt: Date.now() })
check(page.steps.length === N, `(6) page steps ${page.steps.length}`)
page.steps.forEach((s, i) => writeFileSync(out(`steps/${String(i + 1).padStart(2, '0')}.mmd`), s.mermaid))
writeFileSync(out('crosscheck.json'), JSON.stringify({ latest: cc, baseline: baseCc, root: actual.root, counts: page.counts }, null, 2) + '\n')
const d = page.latestDiagram
const lay = layoutUml(d, { w: 960, h: 720 })
for (const theme of ['light', 'dark'] as const) {
  const svg = renderUmlSvg(lay, d, { width: 960, height: 720, theme })
  const f = theme === 'light' ? 'pane-uml.svg' : 'pane-uml-dark.svg'
  writeFileSync(out(f), svg)
  check(svg.length < 131072, `(6) ${f} ${svg.length} chars`)
  check((svg.match(/<g class="uml-box"/g) ?? []).length === lay.boxes.length && lay.boxes.length === d.elements.length, `(6) ${f} boxes ${(svg.match(/<g class="uml-box"/g) ?? []).length} / layout ${lay.boxes.length} / elements ${d.elements.length}`)
  for (const b of ['✓', '+']) check(new RegExp(`class="badge"[^>]*>\\${b}<`).test(svg), `(6) ${f} badge ${b}`)
  check(svg.includes('◌'), `(6) ${f} has a ◌ (planned-not-built) mark`)
}
{
  const cols = 120, rows = 40
  const lr = layoutUml(d, { w: cols * 8, h: rows * 16 }, { charW: 8, lineH: 16 })
  const r = rasterUml(lr, d, cols, rows, 'dark')
  let t = ''
  for (let y = 0; y < rows; y++) { for (let x = 0; x < cols; x++) t += String.fromCodePoint(r[(y * cols + x) * 3]!); t += '\n' }
  writeFileSync(out('pane-uml.txt'), t)
  check(t.includes('┌') && /UmlPane|UmlPa/.test(t), '(6) pane-uml.txt has boxes and names')
}
const focus = { seeds: [] as { id: string; source: 'model' }[] }
const blast = blastRadius(graph, focus.seeds)
const rel = relevance(sol, graph, focus, blast)
const exportInput = { model: sol, graph, positions: layoutLayers(sol, graph, { solution: {}, evidence: {} }, { seed: 1 }), relevance: rel, health: health(sol, graph), blast, uml: page }
const html = exportSolutionHtml(exportInput, { since: sol.seq })
writeFileSync(out('solution.html'), html)
check(html.startsWith(`<title>${EXPORT_TITLE}</title>`) && EXPORT_TITLE === 'Context Window Graph', '(6) html title')
for (const tag of ['<!doctype', '<html', '<head', '<body']) check(!html.toLowerCase().includes(tag), `(6) html has ${tag}`)
const urls = html.match(/https?:\/\/[^\s"'`)<>\\]*/g) ?? []
check(urls.includes(MERMAID_URL), '(6) html imports MERMAID_URL')
for (const u of urls) check(u.startsWith(THREE_CDN) || u === MERMAID_URL, `(6) html url ${u}`)
const css = html.match(/<style>([^]*?)<\/style>/)?.[1] ?? ''
check(/:root\s*\{[^}]*--bg:/.test(css) && /prefers-color-scheme: dark/.test(css) && /:root\[data-theme="dark"\]/.test(css), '(6) html theme tokens')
const umlJson = html.match(/<script type="application\/json" id="cg-uml">([^]*?)<\/script>/)?.[1] ?? ''
check(!umlJson.includes('</') && JSON.parse(umlJson || '{"steps":[]}').steps.length === N, '(6) html cg-uml block')

// ---------------------------------------------------------------- (7) browser
const elementCount = (v: Pick<UmlVariant, 'names'>) => Object.keys(v.names).length
/** the variant the page drew: the full one, or its focused view */
const drawn = (v: UmlVariant, view: string) => (view === 'focused' && v.focused ? v.focused : view === 'tight' && v.tight ? v.tight : view === 'bare' && v.bare ? v.bare : v)
const variantAt = (k: number) => (k === N ? page.latest.components : page.steps[k - 1]!)
const fragment = (mermaidUrl: string) => exportSolutionHtml(exportInput, {
  since: sol.seq, ...(threeDir ? { threeUrl: '/three/' } : {}), mermaidUrl,
})
const localMermaid = mermaidDir ? '/mermaid/mermaid.esm.min.mjs' : MERMAID_URL
const pages: Record<string, string> = {
  '/': wrap(fragment(localMermaid)),
  '/bad': wrap(fragment('/missing/mermaid.esm.min.mjs')),
  '/pane': `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${renderUmlSvg(lay, d, { width: 960, height: 720, theme: 'light' })}</body></html>`,
}
const dirs: [string, string][] = []
if (threeDir) dirs.push(['/three/', threeDir])
if (mermaidDir) dirs.push(['/mermaid/', join(mermaidDir, 'dist')])
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  if (pages[path]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(pages[path]); return }
  for (const [pre, dir] of dirs) {
    if (!path.startsWith(pre)) continue
    const f = join(dir, normalize(path.slice(pre.length)))
    if (f.startsWith(dir + sep) && existsSync(f) && statSync(f).isFile()) {
      res.writeHead(200, { 'content-type': /\.m?js$/.test(f) ? 'text/javascript' : 'application/octet-stream' }); res.end(readFileSync(f)); return
    }
  }
  res.writeHead(404); res.end()
})
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright')
const proxy = process.env.HTTPS_PROXY && !(threeDir && mermaidDir) ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1' } : undefined
const browser = await chromium.launch({ proxy, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
type Page = { evaluate(s: string): Promise<any>; setViewportSize(v: { width: number; height: number }): Promise<void>; waitForFunction(s: string, a?: unknown, o?: object): Promise<unknown>; click(s: string): Promise<void>; selectOption(s: string, v: string): Promise<unknown>; screenshot(o: object): Promise<unknown>; goto(u: string, o?: object): Promise<unknown>; waitForTimeout(ms: number): Promise<void>; on(e: string, f: (x: any) => void): void }
const errorsOf = (p: Page) => { const e: string[] = []; p.on('console', (m) => { if (m.type() === 'error') e.push(m.text()) }); p.on('pageerror', (x) => e.push(String(x))); return e }
const atStep = async (p: Page, k: number) => p.waitForFunction(`window.__cg.uml.step === ${k} && window.__cg.uml.rendered`, null, { timeout: 15000 })
/** step-*.png: the default view as shown at 1280x800 (natural-size Mermaid, framed on the step's changes) */
const viewShot = async (p: Page, path: string) => {
  await p.evaluate(`document.getElementById('cg-panel-uml').scrollTop = 0`)
  await p.screenshot({ path })
}
/** the default view: title size of the framed elements (px on screen), the primary one fully inside #cg-diagram, the legend */
const viewOf = (primary: string, ids: string[]) => `(() => {
  const box = document.getElementById('cg-diagram').getBoundingClientRect(), svg = document.querySelector('#uml svg')
  const k = svg.getBoundingClientRect().width / (svg.viewBox.baseVal.width || svg.getBoundingClientRect().width)
  const title = (g) => g.querySelector('.label-group span, .label-group text') || g
  const hot = [...document.querySelectorAll('#uml g.cg-hot')]
  const u = window.__cg.uml, targets = ${JSON.stringify(ids)}.map((n) => document.querySelector('#uml g[id^="classId-' + n + '-"]')).filter(Boolean)
  const px = hot.map((g) => parseFloat(getComputedStyle(title(g)).fontSize) * k)
  // fully inside, or (when larger than the box) its top-left corner inside and its width/height filling the box
  const inside = (g) => { const r = g.getBoundingClientRect()
    const x = r.width > box.width ? r.left >= box.left - 1 && r.left < box.left + 40 : r.left >= box.left - 1 && r.right <= box.right + 1
    const y = r.height > box.height ? r.top >= box.top - 1 && r.top < box.top + 40 : r.top >= box.top - 1 && r.bottom <= box.bottom + 1
    return x && y }
  const pg = document.querySelector('#uml g[id^="classId-${primary}-"]')
  const rr = pg ? pg.getBoundingClientRect() : null
  return { rects: rr ? [rr.left, rr.top, rr.right, rr.bottom, box.left, box.top, box.right, box.bottom].map(Math.round).join(',') : '', hot: hot.length, minPx: px.length ? Math.min(...px) : 0, zoom: window.__cg.uml.zoom, primary: pg ? inside(pg) : false,
    seen: hot.filter(inside).length, faded: document.getElementById('uml').classList.contains('cg-focus'),
    targets: targets.length, inView: targets.filter(inside).length, off: (u.off || []).length, view: u.view,
    tried: (u.tried || []).join('; '), box: Math.round(box.width) + 'x' + Math.round(box.height), hotEdges: document.querySelectorAll('#uml .edgePaths path.cg-hot').length, hotLabels: [...document.querySelectorAll('#uml .edgeLabel.cg-hot-label')].filter((l) => l.textContent.trim()).length,
    labelOpacity: [...document.querySelectorAll('#uml .edgeLabel.cg-hot-label')].map((l) => getComputedStyle(l).opacity).join(','),
    header: document.getElementById('cg-counts').textContent,
    legend: document.getElementById('cg-legend-uml').textContent }
})()`
const checkView = async (p: Page, k: number, full: UmlVariant, where: string) => {
  const v = drawn(full, String(await p.evaluate('window.__cg.uml.view')))
  if (!v.focus.length) return
  const ids = [...v.focus, ...v.flagged].map((id) => v.names[id]!)
  const r = await p.evaluate(viewOf(v.names[v.focus[0]!]!, ids))
  check(r.hot === v.focus.length, `(7) ${where} step ${k}: ${r.hot} framed elements, focus ${v.focus.length}`)
  // every change wholly inside the view (a partly clipped box is not framed)
  // desktop: every change wholly inside the view. phone (390px): a change that cannot fit at >= 11px may instead have an
  // 'outside the view' chip that scrolls to it — still framed first, the rest one tap away
  if (where === 'phone') check(r.seen >= 1 && r.seen + r.off >= r.hot, `(7) ${where} step ${k}: ${r.seen} of ${r.hot} changes in view, ${r.off} chips`)
  else check(r.seen === r.hot, `(7) ${where} step ${k}: ${r.seen} of ${r.hot} changes wholly in view`)
  // every change and flag is in the view, or has an edge marker pointing to it
  check(r.targets === ids.length && r.inView + r.off >= ids.length, `(7) ${where} step ${k}: ${r.inView} of ${ids.length} changes/flags in view, ${r.off} edge markers`)
  check(r.hotLabels === 0 || r.labelOpacity.split(',').every((o: string) => o === '1'), `(7) ${where} step ${k}: highlighted edge labels faded (${r.labelOpacity})`)
  const hp = /◌ (\d+)/.exec(r.header)?.[1], lp = /◌ (\d+)/.exec(r.legend)?.[1]
  if (k === N) check(hp === lp, `(7) ${where} step ${k}: header ◌ ${hp} != legend ◌ ${lp}`)
  check(r.minPx >= 11, `(7) ${where} step ${k}: framed titles ${r.minPx.toFixed(1)} px (< 11) at zoom ${r.zoom}`)
  check(r.primary, `(7) ${where} step ${k}: first changed element not fully in view (${r.rects})`)
  check(/◌ \d/.test(r.legend) && /\+ \d/.test(r.legend), `(7) ${where} step ${k}: legend ${r.legend}`)
  viewNotes.push(`${where} ${k}: ${r.view} ${r.minPx.toFixed(1)}px z${Number(r.zoom).toFixed(2)} changes ${r.seen}/${r.hot} wholly in view; changes+flags ${r.inView}/${ids.length} wholly in view, ${r.off} markers; hot edges ${r.hotEdges}, labels ${r.hotLabels}${r.faded ? ' faded' : ''}; box ${r.box}; tried ${r.tried}`)
}
const viewNotes: string[] = []
const nodeAttr = (name: string, attr: string) => `(document.querySelector('#uml g[id^="classId-${name}-"]') || { getAttribute: () => 'missing' }).getAttribute('${attr}')`
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
  const p: Page = await ctx.newPage()
  const errors = errorsOf(p)
  try {
    await p.goto(url + '/', { waitUntil: 'networkidle' })
    await p.waitForFunction('window.__cg && window.__cg.uml && (window.__cg.uml.rendered || window.__cg.uml.fallback || window.__cg.uml.error)', null, { timeout: 30000 })
    check((await p.evaluate('window.__cg.uml.fallback')) === false, '(7) Mermaid rendered (not the fallback)')
    for (let k = 1; k <= N; k++) {
      await p.evaluate(`(() => { const r = document.getElementById('cg-step'); r.value = '${k}'; r.dispatchEvent(new Event('input')) })()`)
      await atStep(p, k)
      const u = await p.evaluate('window.__cg.uml')
      const full = variantAt(k), v = drawn(full, u.view)
      check(u.nodes === elementCount(v), `(7) step ${k} (input, ${u.view}): nodes ${u.nodes} != ${elementCount(v)}`)
      const marks = await p.evaluate(`[...document.querySelectorAll('#uml g[id^="classId-"]')].map((g) => [g.id, g.dataset.cgId, g.dataset.cgFlag, g.dataset.cgStatus, g.dataset.cgChange])`) as string[][]
      const bad = marks.filter(([, id, f, s, c]) => { const m = id ? v.marks[v.names[id]!] : undefined; return !m || (m.flag ?? 'none') !== f || m.status !== s || (m.change ?? 'none') !== c })
      check(bad.length === 0, `(7) step ${k}: marks differ on ${bad.map((b) => b[0]).join(',')}`)
      const strikes = await p.evaluate(`[...document.querySelectorAll('#uml g[data-cg-status="abandoned"] .label-group, #uml g[data-cg-status="removed"] .label-group')].map((g) => getComputedStyle(g.querySelector('*') || g).textDecorationLine)`) as string[]
      check(strikes.every((s) => s.includes('line-through')), `(7) step ${k}: removed titles not struck (${strikes.join(',')})`)
      const stepPng = k === 1 ? 'step-start.png' : k === Math.ceil(N / 2) ? 'step-middle.png' : k === N ? 'step-end.png' : ''
      await checkView(p, k, full, 'desktop')
      await viewShot(p, out(stepPng || `steps/view-${String(k).padStart(2, '0')}.png`))
      if (k === 2) {
        check((await p.evaluate(nodeAttr(v.names[W]!, 'data-cg-status'))) === 'abandoned', '(7) step 2 PaneWebGLRenderer abandoned')
        const td = await p.evaluate(`(() => { const g = document.querySelector('#uml g[id^="classId-${v.names[W]}-"] .label-group'); return g ? getComputedStyle(g.querySelector('*') || g).textDecorationLine : 'missing' })()`)
        check(String(td).includes('line-through'), `(7) step 2 PaneWebGLRenderer text-decoration ${td}`)
        await p.screenshot({ path: out('uml-step2.png'), fullPage: true })
      }
      if (k === 6) {
        check((await p.evaluate(nodeAttr(v.names['uml:svg-options']!, 'data-cg-change'))) === 'added', '(7) step 6 SvgOptions added')
        check((await p.evaluate(nodeAttr(v.names['uml:svg-renderer']!, 'data-cg-change'))) === 'none', '(7) step 6 SvgRenderer unchanged')
      }
    }
    // the slider buttons
    const drawnCount = async (k: number) => elementCount(drawn(variantAt(k), String(await p.evaluate('window.__cg.uml.view'))))
    for (let k = N - 1; k >= N - 3; k--) { await p.click('#cg-prev'); await atStep(p, k); check((await p.evaluate('window.__cg.uml.nodes')) === await drawnCount(k), `(7) ◀ to step ${k}`) }
    check((await p.evaluate(`document.getElementById('cg-unplanned').disabled`)) === true, '(7) unplanned select disabled before the latest step')
    for (let k = N - 2; k <= N; k++) { await p.click('#cg-next'); await atStep(p, k); check((await p.evaluate('window.__cg.uml.nodes')) === await drawnCount(k), `(7) ▶ to step ${k}`) }
    // the full diagram on request (the latest step's default may be the focused view)
    if ((await p.evaluate('window.__cg.uml.view')) !== 'full') {
      await p.click('#cg-scope')
      await p.waitForFunction(`window.__cg.uml.rendered && window.__cg.uml.view === 'full'`, null, { timeout: 15000 })
    }
    check((await p.evaluate(`document.getElementById('cg-unplanned').disabled`)) === false, '(7) unplanned select enabled at the latest step')
    const u = await p.evaluate('window.__cg.uml')
    for (const f of UML_FLAGS) check(u.flags[f] === page.counts[f], `(7) latest flags.${f} ${u.flags[f]} != counts ${page.counts[f]}`)
    const panel = String(await p.evaluate(`document.getElementById('cg-check').textContent`))
    for (const s of ['matchSolution', 'core/prng.ts', 'core/tokens.ts']) check(panel.includes(s), `(7) cross-check panel lacks ${s}`)
    await p.screenshot({ path: out('uml.png'), fullPage: true })
    // the fit button shows the whole latest diagram; changes re-frames
    await p.click('#cg-fit'); await p.waitForTimeout(100)
    viewNotes.push(`fit: zoom ${Number(await p.evaluate('window.__cg.uml.zoom')).toFixed(2)}, natural ${await p.evaluate(`(() => { const b = document.querySelector('#uml svg').viewBox.baseVal; return Math.round(b.width) + 'x' + Math.round(b.height) })()`)}`)
    await viewShot(p, out('uml-fit.png'))
    await p.click('#cg-frame'); await p.waitForTimeout(100)
    // the side list's planned member scrolls its element into the view
    await p.evaluate(`[...document.querySelectorAll('#cg-check li button')].find((b) => b.textContent.includes('matchSolution')).click()`)
    await p.waitForTimeout(200)
    check(Boolean(await p.evaluate(`(() => { const g = document.querySelector('#uml g[data-cg-id="uml:live-ingest"]'), b = document.getElementById('cg-diagram').getBoundingClientRect(); if (!g) return false; const r = g.getBoundingClientRect(); return r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom })()`)), '(7) side list matchSolution scrolls LiveIngest into view')
    // unplanned 'none' hides the built-not-planned components
    const n0 = u.nodes, hidden = elementCount(page.latest.components) - elementCount(page.latest.none)
    await p.selectOption('#cg-unplanned', 'none')
    await p.waitForFunction(`window.__cg.uml.rendered && window.__cg.uml.nodes === ${n0 - hidden}`, null, { timeout: 15000 }).catch(() => {})
    check((await p.evaluate('window.__cg.uml.nodes')) === n0 - hidden && hidden > 0, `(7) unplanned none: ${n0} -> ${await p.evaluate('window.__cg.uml.nodes')} (hidden ${hidden})`)
    await p.selectOption('#cg-unplanned', 'components')
    await p.waitForFunction(`window.__cg.uml.rendered && window.__cg.uml.nodes === ${n0}`, null, { timeout: 15000 }).catch(() => {})
    // theme toggle re-renders on the dark background token
    const lightBg = await p.evaluate(`getComputedStyle(document.body).backgroundColor`)
    await p.evaluate(`document.documentElement.dataset.theme = 'dark'`)
    await p.waitForTimeout(400)
    await p.waitForFunction('window.__cg.uml.rendered', null, { timeout: 15000 })
    const darkBg = await p.evaluate(`getComputedStyle(document.body).backgroundColor`)
    const darkToken = await p.evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`)
    check(darkBg !== lightBg && Boolean(darkToken), `(7) dark theme background ${lightBg} -> ${darkBg} (--bg ${darkToken})`)
    await p.screenshot({ path: out('uml-dark.png'), fullPage: true })
    // the 3D tab initialises on first show
    await p.click('[data-tab="3d"]')
    await p.waitForFunction('window.__cg.frames > 3', null, { timeout: 20000 })
    const solN = await p.evaluate('window.__cg.solutionNodes')
    check(solN === Object.keys(sol.nodes).length && solN === 24, `(7) 3D solutionNodes ${solN}`)
    await p.waitForTimeout(600)
    await p.screenshot({ path: out('3d.png') })
  } catch (e) { fails.push(`(7) browser: ${String(e).split('\n')[0]}`) }
  check(errors.length === 0, `(7) console errors: ${errors.join(' | ')}`)
  await ctx.close()

  // phone width, then the Mermaid 404 fallback (and the 3D tab still works)
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const p2: Page = await c2.newPage()
  try {
    await p2.goto(url + '/', { waitUntil: 'networkidle' })
    await p2.waitForFunction('window.__cg.uml.rendered', null, { timeout: 30000 })
    const sw = await p2.evaluate('document.scrollingElement.scrollWidth')
    check(sw <= 390, `(7) 390 px: scrollWidth ${sw}`)
    for (let k = 1; k <= N; k++) {
      await p2.evaluate(`(() => { const r = document.getElementById('cg-step'); r.value = '${k}'; r.dispatchEvent(new Event('input')) })()`)
      await atStep(p2, k)
      await checkView(p2, k, variantAt(k), 'phone')
      await viewShot(p2, out(`steps/phone-${String(k).padStart(2, '0')}.png`))
    }
    await p2.screenshot({ path: out('phone.png') })
    await p2.goto(url + '/bad', { waitUntil: 'networkidle' })
    await p2.waitForFunction('window.__cg.uml.fallback', null, { timeout: 30000 })
    const boxes = await p2.evaluate(`document.querySelectorAll('#uml .uml-box').length`)
    check(boxes > 0, `(7) fallback boxes ${boxes}`)
    await p2.screenshot({ path: out('fallback.png') })
    await p2.click('[data-tab="3d"]')
    await p2.waitForFunction('window.__cg.frames > 3', null, { timeout: 20000 })
    check((await p2.evaluate('window.__cg.solutionNodes')) === 24, '(7) fallback page 3D tab')
  } catch (e) { fails.push(`(7) phone/fallback: ${String(e).split('\n')[0]}`) }
  await c2.close()

  // pane.png: the pane's UML SVG (960x720, light)
  const c3 = await browser.newContext({ viewport: { width: 960, height: 720 } })
  const p3: Page = await c3.newPage()
  await p3.goto(url + '/pane')
  await p3.screenshot({ path: out('pane.png') })
  await c3.close()
} finally { await browser.close(); server.close() }
for (const f of ['uml.png', 'uml-dark.png', 'uml-step2.png', '3d.png', 'step-start.png', 'step-middle.png', 'step-end.png', 'pane.png']) check(existsSync(out(f)), `(7) ${f} written`)

writeFileSync(out('view.log'), viewNotes.join('\n') + '\n')
if (fails.length) { console.error(`acceptance:uml failed (${fails.length}):\n` + fails.join('\n')); process.exit(1) }
console.log(`ok: ${N} steps, ${Object.keys(uml.elements).length} UML elements, ${Object.keys(sol.nodes).length} solution nodes; latest counts ${JSON.stringify(Object.fromEntries(UML_FLAGS.map((f) => [f, page.counts[f]])))}; ${notes.join('; ')}; outputs in ${outDir}`)
