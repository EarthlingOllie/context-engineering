// v3-14: the Mermaid emitter's output renders in real mermaid@11.4.1 (headless chromium through Playwright).
// Usage: node scripts/mermaid-check.ts [--mermaid <dir of the mermaid npm package or its dist/>]
// Without --mermaid the bundle comes from the jsdelivr URL through HTTPS_PROXY.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, normalize, resolve, sep } from 'node:path'
import { applyDesignOps, emptyUml, parseDesignSeed } from '../src/core/uml.ts'
import { emptyModel } from '../src/core/solution.ts'
import { assemble, scanFile } from '../src/core/codeScan.ts'
import { buildDiagram } from '../src/core/diagram.ts'
import type { Diagram, DiagramElement, DiagramRelation, Unplanned } from '../src/core/diagram.ts'
import { toMermaid } from '../src/core/mermaid.ts'
import type { MermaidOut } from '../src/core/mermaid.ts'
import { MERMAID_URL } from '../src/core/exportHtml.ts'

interface Case { name: string; out: MermaidOut }

function cases(): Case[] {
  const out: Case[] = []
  const seed = parseDesignSeed(readFileSync(new URL('../test/fixtures/uml-small.json', import.meta.url), 'utf8'))
  const { sol, uml } = applyDesignOps({ sol: emptyModel(), uml: emptyUml() }, seed.ops).state
  const src: Record<string, string> = {
    'core/render.ts': "import { helper } from '../util/helper.ts'\nexport interface Options { theme: string }\nexport function render(scene: unknown): string { return '' }",
    'core/gl.ts': 'export class GlRenderer { frame(): void {} }',
    'util/helper.ts': 'export function helper<T>(x: Map<string, T>): T | null { return null }\nexport interface Extra { x: number; cb: (a: string) => void }',
    'util/prng.ts': 'export function mulberry(seed: number): () => number { return () => seed }',
  }
  const actual = assemble(Object.keys(src).map((p) => scanFile(p, src[p]!)), '/repo/src')
  const steps = buildDiagram({ uml, sol }).steps
  for (const a of [null, actual]) {
    for (let k = 0; k <= steps; k++) {
      const variants: Unplanned[] = k === steps && a ? ['components', 'all', 'none'] : ['components']
      for (const v of variants) out.push({ name: `uml-small step ${k}${a ? ' +code' : ''} ${v}`, out: toMermaid(buildDiagram({ uml, sol, actual: a, step: k, unplanned: v })) })
    }
  }
  out.push({ name: 'adversarial', out: toMermaid(adversarial(), { maxMembers: 30 }) })
  out.push({ name: 'adversarial TB, 3 members', out: toMermaid(adversarial(), { direction: 'TB', maxMembers: 3 }) })
  out.push({ name: 'control: unsanitised braces', out: { text: 'classDiagram\n  class A["x"] {\n    }}} broken\n  }\n', names: { a: 'A' } } })
  out.push({ name: 'empty', out: toMermaid(buildDiagram({ uml: emptyUml() })) })
  return out
}

function adversarial(): Diagram {
  const nasty = [
    'Quote"d \'single\'', 'Brace{s} [brackets]', 'Generic<T, Map<K, V>>', 'Pipe | union | x', 'Ünïcødé 日本語 ✓ ◌',
    'N'.repeat(60), 'Line\nbreak\ttab', '%%{init: {"theme":"dark"}}%%', 'click E_a call alert()', '<script>alert(1)</script>',
    'callback href javascript:x', 'semi; colon: "x"', '`back`ticks`', '~tilde~', 'a :: b', '*star$', '()', '<<interface>>',
  ]
  const kinds = ['component', 'class', 'interface'] as const
  const elements: DiagramElement[] = nasty.map((n, i) => ({
    id: i === 5 ? `uml:${'n'.repeat(48)}` : `uml:n${i}`, name: n, kind: kinds[i % 3]!, stereotype: i % 4 === 0 ? n : undefined,
    members: nasty.map((m, k) => ({ text: k % 2 ? `+${m}(a: ${m}) ${m}` : `${m}: ${m}`, kind: k % 2 ? 'operation' as const : 'attribute' as const, removed: k === 3, flag: k % 5 === 0 ? 'planned-not-built' as const : undefined })),
    status: i % 7 === 3 ? 'removed' : i % 7 === 4 ? 'abandoned' : 'active', flag: (['matching', 'planned-not-built', 'removed-but-built', 'unchecked', null] as const)[i % 5]!,
    change: (['added', 'changed', 'removed', null] as const)[i % 4]!, decisions: [], source: 'intended',
  }))
  elements.push({ id: 'code:click callback/href<x>.ts', name: 'href<x>.ts', kind: 'component', members: [], status: 'active', flag: 'built-not-planned', change: null, decisions: [], source: 'actual' })
  const relKinds = ['association', 'dependency', 'realization', 'composition', 'generalization'] as const
  const relations: DiagramRelation[] = []
  for (let i = 0; i < elements.length; i++) {
    const kind = relKinds[i % 5]!
    const from = elements[i]!.id
    const to = elements[(i + 1) % elements.length]!.id
    relations.push({ id: `${from}|${kind}|${to}`, from, to, kind, label: nasty[i % nasty.length], status: i % 6 === 5 ? 'abandoned' : 'active', flag: i % 3 ? 'planned-not-built' : null, change: null, source: 'intended' })
  }
  relations.push({ id: 'self', from: 'uml:n1', to: 'uml:n1', kind: 'association', label: 'self', status: 'active', flag: null, change: null, source: 'intended' })
  return { step: 1, steps: 1, current: null, elements, relations, counts: buildDiagram({ uml: emptyUml() }).counts, scan: null, hidden: 0 }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const mi = argv.indexOf('--mermaid')
  let dir = mi >= 0 ? resolve(argv[mi + 1] ?? '') : undefined
  if (dir && existsSync(join(dir, 'dist'))) dir = join(dir, 'dist')
  if (dir && !existsSync(join(dir, 'mermaid.esm.min.mjs'))) { console.error(`no mermaid.esm.min.mjs in ${dir}`); return 2 }
  const page = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="out"></div><script type="module">
import mermaid from ${JSON.stringify(dir ? '/mermaid/mermaid.esm.min.mjs' : MERMAID_URL)}
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base' })
let n = 0
window.__check = async (text, names) => {
  try {
    const { svg } = await mermaid.render('cg-check-' + (++n), text)
    const host = document.getElementById('out')
    host.innerHTML = svg
    const missing = []
    const counts = {}
    for (const name of names) {
      const c = host.querySelectorAll('g[id^="classId-' + name + '-"]').length
      counts[name] = c
      if (c !== 1) missing.push(name + '=' + c)
    }
    const err = host.querySelector('.error-icon, [aria-roledescription="error"]') ? 'error diagram' : null
    return { ok: !missing.length && !err, missing, err, nodes: host.querySelectorAll('g[id^="classId-"]').length, chars: svg.length }
  } catch (e) { return { ok: false, err: String(e && e.message || e).slice(0, 400), missing: [] } }
}
window.__ready = true
</script></body></html>`
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (path === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page); return }
    const file = dir && path.startsWith('/mermaid/') ? join(dir, normalize(path.slice(9))) : ''
    if (!file || !file.startsWith(dir + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(readFileSync(file))
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  const require = createRequire(import.meta.url)
  const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright')
  const proxy = process.env.HTTPS_PROXY && !dir ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1' } : undefined
  const browser = await chromium.launch({ proxy })
  let failed = 0
  try {
    const p = await browser.newPage()
    const pageErrors: string[] = []
    p.on('pageerror', (e: Error) => pageErrors.push(String(e)))
    await p.goto(url)
    const loaded = await p.waitForFunction('window.__ready === true', null, { timeout: 30000 }).then(() => true, () => false)
    if (!loaded) {
      console.log(`FAIL mermaid did not load from ${dir ?? MERMAID_URL}${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''} (try --mermaid <local package dir>)`)
      return 1
    }
    const all = cases()
    for (const c of all) {
      const names = Object.values(c.out.names)
      const r = await p.evaluate(([t, n]: [string, string[]]) => (window as unknown as { __check(t: string, n: string[]): Promise<unknown> }).__check(t, n), [c.out.text, names]) as { ok: boolean; missing: string[]; err: string | null; nodes?: number }
      if (c.name.startsWith('control')) {
        if (r.ok) { failed++; console.log(`FAIL ${c.name}: rendered, so the check cannot see a broken diagram`) }
        else console.log(`ok   ${c.name}: rejected as expected (${(r.err ?? r.missing.join(' ')).replace(/\s+/g, ' ').slice(0, 60)})`)
        continue
      }
      if (!r.ok) { failed++; console.log(`FAIL ${c.name}: ${r.err ?? ''} missing ${r.missing.join(' ')}`) }
      else console.log(`ok   ${c.name}: ${names.length} classes, ${r.nodes} nodes`)
    }
    if (pageErrors.length) { failed++; console.log(`page errors: ${pageErrors.join(' | ')}`) }
    console.log(`${all.length - failed}/${all.length} rendered (mermaid ${dir ? `local ${dir}` : MERMAID_URL})`)
  } finally { await browser.close(); server.close() }
  return failed ? 1 : 0
}

process.exitCode = await main()
