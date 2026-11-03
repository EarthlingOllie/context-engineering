// Open an exported solution fragment in headless chromium and probe it (v2-15; reused by acceptance-session).
// The fragment is wrapped in a minimal skeleton, as a claude.ai Artifact host would. three.js comes from the
// CDN through HTTPS_PROXY, or from a local copy of the three@0.170.0 npm package (--three) on 127.0.0.1.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, normalize, resolve, sep } from 'node:path'

export interface Probe { solutionNodes: number; evidenceNodes: number; openQuestions: number; layers: string; replaying: boolean; visibleMeshes: number; frames: number }
export interface Viewport { width: number; height: number }
export interface PageRun { viewport: Viewport; errors: string[]; probe?: Probe; layersCycle: { layers: string; visibleMeshes: number }[]; replay: { started: boolean; endedMs: number }; scrollWidth: number; png: string }

export const wrap = (fragment: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${fragment}</body></html>`

/** fragmentFor(threeBase) must return the fragment importing three from that base. */
export async function runPage(fragmentFor: (threeBase?: string) => string, viewports: Viewport[], pngFor: (v: Viewport) => string, threeDirIn?: string, opts: { interact?: boolean; theme?: 'dark' | 'light' } = {}): Promise<PageRun[]> {
  const threeDir = threeDirIn ? resolve(threeDirIn) : undefined
  const page = wrap(fragmentFor(threeDir ? '/three/' : undefined))
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (path === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page); return }
    const file = threeDir && path.startsWith('/three/') ? join(threeDir, normalize(path.slice(7))) : ''
    if (!file || !file.startsWith(threeDir + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(readFileSync(file))
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  const require = createRequire(import.meta.url)
  const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright')
  const proxy = process.env.HTTPS_PROXY && !threeDir ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1' } : undefined
  const browser = await chromium.launch({ proxy, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const runs: PageRun[] = []
  try {
    for (const viewport of viewports) {
      const errors: string[] = []
      const run: PageRun = { viewport, errors, layersCycle: [], replay: { started: false, endedMs: -1 }, scrollWidth: -1, png: pngFor(viewport) }
      runs.push(run)
      const ctx = await browser.newContext({ viewport, colorScheme: opts.theme ?? 'dark' })
      const p = await ctx.newPage()
      p.on('console', (m: { type(): string; text(): string }) => { if (m.type() === 'error') errors.push(m.text()) })
      p.on('pageerror', (e: Error) => errors.push(String(e)))
      try {
        await p.goto(url, { waitUntil: 'networkidle' })
        await p.waitForSelector('canvas', { timeout: 15000 })
        await p.waitForFunction('window.__cg && window.__cg.frames > 3 && !window.__cg.replaying', null, { timeout: 15000 })
        await p.waitForTimeout(900)
        run.probe = await p.evaluate('({...window.__cg})')
        run.scrollWidth = await p.evaluate('document.documentElement.scrollWidth')
        await p.screenshot({ path: run.png })
        if (opts.interact !== false) {
          for (let k = 0; k < 3; k++) {
            await p.click('#cg-layers')
            await p.waitForTimeout(150)
            run.layersCycle.push(await p.evaluate('({ layers: window.__cg.layers, visibleMeshes: window.__cg.visibleMeshes })'))
          }
          await p.click('#cg-replay')
          run.replay.started = await p.evaluate('window.__cg.replaying')
          const t0 = Date.now()
          await p.waitForFunction('!window.__cg.replaying', null, { timeout: 6000, polling: 50 }).then(() => { run.replay.endedMs = Date.now() - t0 }, () => {})
        }
      } catch (e) { errors.push(String(e).split('\n')[0]!) }
      await ctx.close()
    }
  } finally { await browser.close(); server.close() }
  return runs
}
