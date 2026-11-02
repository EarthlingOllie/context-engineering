// Export smoke test (feature 15): render the fixture to a standalone WebGL page, open it in headless
// chromium (three.js from the CDN through HTTPS_PROXY), require a <canvas> and no console errors, screenshot.
// usage: node scripts/export-smoke.ts <out.html> <out.png> [--three <extracted three@0.170.0 package dir>]
// --three serves three.js from a local copy of the npm package on 127.0.0.1 instead of the CDN
// (use it where the egress policy blocks cdn.jsdelivr.net); out.html itself always points at the CDN.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, normalize, resolve, sep } from 'node:path'
import { buildGraph } from '../src/core/ingest.ts'
import { blastRadius } from '../src/core/blast.ts'
import { layout } from '../src/core/layout.ts'
import { exportHtml } from '../src/core/exportHtml.ts'

const argv = process.argv.slice(2)
const ti = argv.indexOf('--three')
const threeDir = ti >= 0 ? resolve(argv.splice(ti, 2)[1]!) : undefined
const [htmlOut = 'context-graph.html', pngOut = 'export.png'] = argv.map((p) => resolve(p))
const g = buildGraph(readFileSync(new URL('../test/fixtures/session-small.jsonl', import.meta.url), 'utf8'))
const blast = blastRadius(g, [])
const pos = layout(g, {}, { seed: 1 })
const title = 'context-graph · session-small'
writeFileSync(htmlOut!, exportHtml(g, pos, blast, { title }))

let url = 'file://' + htmlOut
let server: Server | undefined
if (threeDir) {
  const page = exportHtml(g, pos, blast, { title, threeUrl: '/three/' })
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return }
    const file = path.startsWith('/three/') ? join(threeDir, normalize(path.slice(7))) : ''
    if (!file.startsWith(threeDir + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(readFileSync(file))
  })
  await new Promise<void>((ok) => server!.listen(0, '127.0.0.1', ok))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
}

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright')
const proxy = process.env.HTTPS_PROXY && !threeDir ? { server: process.env.HTTPS_PROXY } : undefined
const browser = await chromium.launch({ proxy, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errors: string[] = []
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } })
  page.on('console', (m: { type(): string; text(): string }) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e: Error) => errors.push(String(e)))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: pngOut })
} catch (e) { errors.push(String(e).split("\n")[0]!) } finally { await browser.close(); server?.close() }
if (errors.length) { console.error('console errors:\n' + errors.join('\n')); process.exit(1) }
console.log(`ok: canvas found, no console errors, ${Object.keys(g.nodes).length} nodes, blast ${Object.keys(blast.weights).length}; wrote ${htmlOut} and ${pngOut}`)
