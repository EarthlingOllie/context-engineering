// exportHtml: Graph + positions + blast -> one self-contained three.js WebGL page (design.md 4.7).
// Runs in a browser, not the pane; uses the same positions as the pane so both views match.
import { KIND_COLORS } from './scene.ts'
import { escapeXml } from './svg.ts'
import type { BlastRadius, Graph, Vec3 } from './types.ts'

export const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'
/** mermaid 11.4.1 ESM bundle (v3 design.md 4.8) */
export const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs'

export interface ExportOptions { title: string; threeUrl?: string; note?: string }

/** Compact node record embedded in the page: p = position, t = tokens, w = blast weight, h = hop. */
interface ExportNode { id: string; k: string; l: string; t: number; p: [number, number, number]; w: number; h?: number; s?: 1; o?: 1 }

export function exportHtml(g: Graph, pos: Record<string, Vec3>, blast: BlastRadius, opts: ExportOptions): string {
  const base = (opts.threeUrl ?? THREE_CDN).replace(/\/?$/, '/')
  const nodes: ExportNode[] = Object.values(g.nodes).map((n) => {
    const p = pos[n.id] ?? { x: 0, y: 0, z: 0 }
    const r: ExportNode = { id: n.id, k: n.kind, l: n.label, t: n.tokens, p: [p.x, p.y, p.z], w: blast.weights[n.id] ?? 0 }
    const h = blast.hops[n.id]
    if (h !== undefined) r.h = h
    if (blast.seeds.includes(n.id)) r.s = 1
    if (!n.inWindow) r.o = 1
    return r
  })
  const index = new Map(nodes.map((n, i) => [n.id, i]))
  const edges = g.edges.flatMap((e) => (index.has(e.from) && index.has(e.to) ? [[index.get(e.from)!, index.get(e.to)!]] : []))
  const colors = Object.fromEntries(Object.entries(KIND_COLORS).map(([k, c]) => [k, c]))
  const data = { title: opts.title, note: opts.note ?? '', nodes, edges, centroid: blast.centroidIds, tokens: blast.tokens, colors }
  // JSON inside <script>: escape '<' so no '</script' or '<!--' can appear in the block.
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const importmap = JSON.stringify({ imports: { three: base + 'build/three.module.js', 'three/addons/': base + 'examples/jsm/' } })
  const title = escapeXml(opts.title)
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
html,body{margin:0;height:100%;background:#0d1117;color:#c9d1d9;font:12px ui-monospace,monospace;overflow:hidden}
#hud{position:fixed;left:12px;top:10px;max-width:46ch;pointer-events:none}
#hud h1{font-size:14px;margin:0 0 4px}
#legend span{display:inline-block;margin-right:10px}#legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}
#tip{position:fixed;pointer-events:none;background:#161b22;border:1px solid #30363d;padding:4px 6px;border-radius:4px;display:none;max-width:50ch}
.tag{position:fixed;left:0;top:0;pointer-events:none;color:#ffd866;text-shadow:0 0 3px #000;white-space:nowrap;max-width:40ch;overflow:hidden;text-overflow:ellipsis}
#focus{position:fixed;right:12px;top:10px;background:#21262d;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:6px 10px;font:inherit;cursor:pointer}
</style>
<script type="importmap">${importmap}</script>
</head><body>
<div id="hud"><h1>${title}</h1><div id="stats"></div><div id="legend"></div></div>
<button id="focus" type="button">focus blast radius</button>
<div id="tip"></div>
<script type="application/json" id="graph">${json}</script>
<script type="module">${CLIENT}</script>
</body></html>
`
}

// Browser-side script. Plain string (no interpolation) so it can be read as-is in the exported page.
const CLIENT = String.raw`
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
const D = JSON.parse(document.getElementById('graph').textContent)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio))
renderer.setSize(innerWidth, innerHeight)
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)
scene.add(new THREE.AmbientLight(0xffffff, 0.55))
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(1, 2, 3); scene.add(sun)
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 5000)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const N = D.nodes.length
const geo = new THREE.SphereGeometry(1, 20, 14)
const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, transparent: true })
const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, N))
const m4 = new THREE.Matrix4(), col = new THREE.Color(), dim = new THREE.Color(0x0d1117)
const radius = (t) => Math.max(0.6, Math.min(4, 0.12 * Math.sqrt(Math.max(1, t))))
D.nodes.forEach((n, i) => {
  const r = radius(n.t) * (n.w > 0 ? 1 + 0.6 * n.w : 1)
  m4.makeScale(r, r, r).setPosition(n.p[0], n.p[1], n.p[2])
  mesh.setMatrixAt(i, m4)
  col.setHex(D.colors[n.k] ?? 0xffffff).lerp(dim, n.w > 0 ? 0 : (n.o ? 0.85 : 0.6))
  if (n.w > 0) col.lerp(new THREE.Color(0xffd866), 0.3 * n.w)
  mesh.setColorAt(i, col)
})
mesh.count = N
scene.add(mesh)

// Halos around blast-radius nodes, brighter for nearer hops; seeds pulse.
const halos = []
D.nodes.forEach((n) => {
  if (!(n.w >= 0.2)) return
  const ring = new THREE.Mesh(new THREE.SphereGeometry(radius(n.t) * (1 + 0.6 * n.w) * 1.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd866, transparent: true, opacity: 0.18 + 0.3 * n.w, depthWrite: false }))
  ring.position.set(n.p[0], n.p[1], n.p[2]); ring.userData = n; scene.add(ring); halos.push(ring)
})

const lp = new Float32Array(D.edges.length * 6), lc = new Float32Array(D.edges.length * 6)
D.edges.forEach(([a, b], i) => {
  const A = D.nodes[a], B = D.nodes[b], w = Math.min(A.w, B.w), c = 0.18 + 0.75 * w
  lp.set([...A.p, ...B.p], i * 6)
  lc.set(w > 0 ? [c, c * 0.85, c * 0.4, c, c * 0.85, c * 0.4] : [c, c, c, c, c, c], i * 6)
})
const lg = new THREE.BufferGeometry()
lg.setAttribute('position', new THREE.BufferAttribute(lp, 3))
lg.setAttribute('color', new THREE.BufferAttribute(lc, 3))
scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })))

// Camera framing: centroid of the blast radius, distance from its bounding sphere.
function frame() {
  const ids = new Set(D.centroid)
  let pts = D.nodes.filter((n) => ids.has(n.id))
  if (!pts.length) pts = D.nodes.filter((n) => !n.o)
  if (!pts.length) pts = D.nodes
  const c = new THREE.Vector3()
  pts.forEach((n) => c.add(new THREE.Vector3(...n.p)))
  if (pts.length) c.divideScalar(pts.length)
  let r = 8
  D.nodes.filter((n) => n.w > 0).forEach((n) => { r = Math.max(r, c.distanceTo(new THREE.Vector3(...n.p)) + radius(n.t)) })
  const d = r / Math.tan((camera.fov * Math.PI) / 360) * 1.35
  return { target: c, eye: c.clone().add(new THREE.Vector3(0.45, 0.35, -1).normalize().multiplyScalar(d)) }
}
let tween = null
function focusBlast(instant) {
  const f = frame()
  if (instant) { camera.position.copy(f.eye); controls.target.copy(f.target); controls.update(); return }
  tween = { t0: performance.now(), fromE: camera.position.clone(), fromT: controls.target.clone(), ...f }
}
focusBlast(true)
document.getElementById('focus').addEventListener('click', () => focusBlast(false))

const blastN = D.nodes.filter((n) => n.w > 0).length
const total = D.nodes.filter((n) => !n.o).reduce((a, n) => a + n.t, 0)
document.getElementById('stats').textContent = N + ' nodes · blast ' + blastN + ' nodes / ' + D.tokens + ' tok of ' + total + (D.note ? ' · ' + D.note : '')
document.getElementById('legend').innerHTML = Object.entries(D.colors).map(([k, c]) => '<span><i style="background:#' + c.toString(16).padStart(6, '0') + '"></i>' + k + '</span>').join('')

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = document.getElementById('tip')
addEventListener('pointermove', (ev) => {
  mouse.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1)
  ray.setFromCamera(mouse, camera)
  const hit = ray.intersectObject(mesh)[0]
  if (hit && hit.instanceId !== undefined) {
    const n = D.nodes[hit.instanceId]
    tip.textContent = n.k + ' · ' + n.l + ' · ' + n.t + ' tok' + (n.h !== undefined ? ' · hop ' + n.h : '') + (n.o ? ' · compacted' : '')
    tip.style.left = ev.clientX + 12 + 'px'; tip.style.top = ev.clientY + 12 + 'px'; tip.style.display = 'block'
  } else tip.style.display = 'none'
})
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) })

// HTML labels for blast-radius nodes, re-projected every frame.
const tags = D.nodes.filter((n) => n.w >= 0.25).sort((a, b) => b.w - a.w).map((n) => {
  const el = document.createElement('div')
  el.className = 'tag'; el.textContent = (n.s ? '◎ ' : '') + n.l
  document.body.appendChild(el)
  return { n, el, v: new THREE.Vector3() }
})
function placeTags() {
  const boxes = []
  for (const t of tags) {
    t.v.set(...t.n.p).project(camera)
    const x = (t.v.x + 1) / 2 * innerWidth + 10, y = (1 - t.v.y) / 2 * innerHeight - 8
    const w = Math.min(40, t.el.textContent.length) * 7.3, h = 15
    const on = t.v.z < 1 && Math.abs(t.v.x) < 1.05 && Math.abs(t.v.y) < 1.05 &&
      !boxes.some((b) => x < b.x + b.w && b.x < x + w && y < b.y + h && b.y < y + h)
    if (on) boxes.push({ x, y, w, h })
    t.el.style.display = on ? 'block' : 'none'
    t.el.style.transform = 'translate(' + x + 'px,' + y + 'px)'
  }
}

renderer.setAnimationLoop((now) => {
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / 700), e = k * k * (3 - 2 * k)
    camera.position.lerpVectors(tween.fromE, tween.eye, e); controls.target.lerpVectors(tween.fromT, tween.target, e)
    if (k >= 1) tween = null
  }
  const pulse = 1 + 0.12 * Math.sin(now / 260)
  halos.forEach((h) => { if (h.userData.s) h.scale.setScalar(pulse) })
  controls.update()
  renderer.render(scene, camera)
  placeTags()
})
`

// ---------------------------------------------------------------------------------------------
// v2 (design.md 4.9): the solution page. Both layers in WebGL, Artifact-safe by default: a fragment
// with no doctype/html/head/body, three.js only from cdn.jsdelivr.net, colours as :root tokens.

import { SHAPES, solutionSummary } from './scene.ts'
import { summaryLine } from './svg.ts'
import type { HealthReport } from './health.ts'
import type { Relevance } from './relevance.ts'
import type { SolutionModel } from './types.ts'
import type { UmlPageData } from './diagram.ts'
import { layoutUml, renderUmlSvg, UML_COLORS } from './umlPane.ts'

export const EXPORT_TITLE = 'Context Window Graph'

export interface SolutionExportInput {
  model: SolutionModel
  graph: Graph
  positions: { solution: Record<string, Vec3>; evidence: Record<string, Vec3> }
  relevance: Relevance
  health: HealthReport
  blast: BlastRadius
  /** v3: the UML tab's data (optional: v2 callers get an empty-state UML tab) */
  uml?: UmlPageData
}
export interface SolutionExportOptions {
  /** default 'Context Window Graph' */
  title?: string
  threeUrl?: string
  /** wrap the fragment in a doctype/html/head/body skeleton (default false: Artifact fragment) */
  document?: boolean
  note?: string
  /** nodes with createdSeq > since grow in on load (default model.promptSeq) */
  since?: number
  /** v3: overrides MERMAID_URL (tests serve a local copy) */
  mermaidUrl?: string
  /** v3: the tab shown first (default 'uml') */
  tab?: 'uml' | '3d'
}

/** world radius per solution kind (matches scene.ts SOL_R) */
const SOL_WR: Record<string, number> = { goal: 16, component: 11, decision: 9 }

export function exportSolutionHtml(input: SolutionExportInput, opts: SolutionExportOptions = {}): string {
  const { model: m, graph: g, positions, relevance: rel, health: hl } = input
  const base = (opts.threeUrl ?? THREE_CDN).replace(/\/?$/, '/')
  const title = escapeXml(opts.title ?? EXPORT_TITLE)
  const r1 = (v: number) => Math.round(v * 10) / 10
  const at = (p: Vec3 | undefined): [number, number, number] => (p ? [r1(p.x), r1(p.y), r1(p.z)] : [0, 0, 0])

  const sol = Object.values(m.nodes).sort((a, b) => a.createdSeq - b.createdSeq || (a.id < b.id ? -1 : 1))
  const ev = Object.values(g.nodes)
  const si = new Map(sol.map((n, i) => [n.id, i]))
  const ei = new Map(ev.map((n, i) => [n.id, i]))
  const solution = sol.map((n) => {
    const h = hl.byNode[n.id]
    return {
      id: n.id, k: n.kind, l: n.label, s: n.status, sh: SHAPES[n.kind], r: SOL_WR[n.kind] ?? 8,
      h: h?.state ?? 'never-loaded', hc: [h?.inWindow ?? 0, h?.compacted ?? 0, h?.missing ?? 0],
      w: Math.round((rel.weights[n.id] ?? 0) * 100) / 100, c: n.createdSeq, p: at(positions.solution[n.id]),
      ...(n.reason ? { why: n.reason } : {}),
    }
  })
  const evidence = ev.map((n) => ({
    id: n.id, k: n.kind, l: n.label, t: n.tokens, p: at(positions.evidence[n.id]),
    w: Math.round((rel.weights[n.id] ?? input.blast.weights[n.id] ?? 0) * 100) / 100, ...(n.inWindow ? {} : { o: 1 }),
  }))
  // Solution edges: [from, to, kind, toEvidence?]; supported-by points into the evidence array.
  const sedges: [number, number, string, number?][] = []
  for (const e of m.edges) {
    const a = si.get(e.from)
    if (a === undefined) continue
    if (e.kind === 'supported-by') { const b = ei.get(e.to); if (b !== undefined) sedges.push([a, b, e.kind, 1]) } else {
      const b = si.get(e.to); if (b !== undefined) sedges.push([a, b, e.kind])
    }
  }
  const eedges = g.edges.flatMap((e) => (ei.has(e.from) && ei.has(e.to) ? [[ei.get(e.from)!, ei.get(e.to)!]] : []))
  const summary = solutionSummary(m, hl)
  const data = {
    header: Object.keys(m.nodes).length ? summaryLine(summary) : 'No solution model yet · evidence layer only',
    note: opts.note ?? '', since: opts.since ?? m.promptSeq, kinds: summary.kinds,
    focus: [...rel.touched, ...rel.bearing].filter((id) => si.has(id)),
    colors: KIND_COLORS, solution, evidence, sedges, eedges,
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const importmap = JSON.stringify({ imports: { three: base + 'build/three.module.js', 'three/addons/': base + 'examples/jsm/' } })
  const tab = opts.tab ?? 'uml'
  const uml = umlSection(input.uml, tab)
  const umlJson = JSON.stringify(uml.data).replace(/</g, '\\u003c')
  const mermaidUrl = input.uml && input.uml.steps.length ? (opts.mermaidUrl ?? MERMAID_URL) : ''
  const head = `<title>${title}</title>\n<style>${CSS}${UML_CSS}</style>\n<script type="importmap">${importmap}</script>\n`
  const sel = (t: 'uml' | '3d') => `aria-selected="${tab === t}"`
  const body = `<nav id="cg-tabs" role="tablist"><button type="button" role="tab" data-tab="uml" ${sel('uml')}>UML design</button><button type="button" role="tab" data-tab="3d" ${sel('3d')}>3D solution map</button></nav>
<section id="cg-panel-uml" role="tabpanel"${tab === 'uml' ? '' : ' hidden'}>
${uml.html}
</section>
<div id="cg-root" role="tabpanel"${tab === '3d' ? '' : ' hidden'}>
<div id="cg-hud"><div id="cg-header"></div><div id="cg-legend"></div><div id="cg-oq"></div></div>
<div id="cg-buttons"><button type="button" id="cg-focus">focus</button><button type="button" id="cg-layers">layers: both</button><button type="button" id="cg-replay">replay</button></div>
<div id="cg-tip"></div>
</div>
<script type="application/json" id="cg-data">${json}</script>
<script type="application/json" id="cg-uml">${umlJson}</script>
<script type="module">const MERMAID_URL = ${JSON.stringify(mermaidUrl).replace(/</g, '\\u003c')}${UML_CLIENT}</script>
<script type="module">${SOLUTION_CLIENT}</script>
`
  if (!opts.document) return head + body
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n${head}</head><body>\n${body}</body></html>\n`
}

const CSS = `
:root{--bg:#ffffff;--fg:#1f2328;--muted:#59636e;--panel:rgba(246,248,250,.92);--border:#d1d9e0;--grid:#e3e8ee;--edge:#8c959f;--ev:0.55;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--panel:rgba(22,27,34,.9);--border:#30363d;--grid:#3d444d;--edge:#6e7681;--ev:0.45;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--panel:rgba(22,27,34,.9);--border:#30363d;--grid:#3d444d;--edge:#6e7681;--ev:0.45;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--fg);overflow:hidden}
#cg-root{position:fixed;top:var(--tabs-h);left:0;right:0;bottom:0;overflow:hidden;background:var(--bg);color:var(--fg);font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
#cg-root canvas{display:block;position:absolute;inset:0}
#cg-hud{position:absolute;left:16px;top:12px;right:16px;max-width:min(64ch,calc(100% - 32px));box-sizing:border-box;pointer-events:none;overflow-wrap:anywhere}
#cg-header{font-weight:600;font-size:13px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px 8px}
#cg-legend{margin-top:6px;color:var(--muted)}
#cg-legend span{display:inline-block;margin-right:10px;white-space:nowrap}
#cg-legend b{font-weight:normal;margin-right:3px}
#cg-oq{margin-top:6px;pointer-events:auto;display:flex;flex-direction:column;align-items:flex-start;gap:3px}
#cg-oq button{font:inherit;color:var(--fg);background:var(--panel);border:1px dashed currentColor;border-radius:4px;padding:2px 6px;cursor:pointer;text-align:left;max-width:100%}
#cg-buttons{position:absolute;right:16px;bottom:16px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:calc(100% - 32px)}
#cg-buttons button{font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer}
#cg-tip{position:absolute;pointer-events:none;background:var(--panel);border:1px solid var(--border);padding:4px 6px;border-radius:4px;display:none;max-width:min(50ch,calc(100% - 32px))}
.cg-tag{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;max-width:30ch;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 3px var(--bg),0 0 3px var(--bg)}
.cg-tag.sol{font-weight:600}.cg-tag.goal{font-size:14px;max-width:48ch}.cg-tag.ev{color:var(--muted);font-size:11px}
.cg-lead{position:absolute;left:0;top:0;height:1px;background:var(--muted);opacity:.5;transform-origin:0 0;pointer-events:none}
.cg-tag.abandoned{text-decoration:line-through;opacity:.45}
@media (max-width:600px){#cg-legend{display:none}.cg-tag{max-width:22ch}}
`

// Browser-side module for the solution page. Plain string: no interpolation.
const SOLUTION_CLIENT = String.raw`
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
// v3: the 3D tab initialises the first time it is shown, so it sizes from a visible container.
let started = false
function maybeStart() { if (!started && !document.getElementById('cg-root').hidden) { started = true; init3d() } }
addEventListener('cg-tab', maybeStart)
maybeStart()
function init3d() {
const D = JSON.parse(document.getElementById('cg-data').textContent)
const root = document.getElementById('cg-root')
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
const W = () => root.clientWidth || innerWidth, H = () => root.clientHeight || innerHeight
const GLYPH = { goal: '◎', component: '●', decision: '■', requirement: '▲', constraint: '◆', assumption: '◇', dependency: '⬡', risk: '✕', question: '?' }
const EDGE = { 'depends-on': 0x8c959f, constrains: 0xd0700a, 'decided-by': 0x3b82e0, contradicts: 0xe0484a, 'supported-by': 0x8c959f }
const HEALTH = { 'in-window': 0x2f9e4f, compacted: 0xd0900a, 'never-loaded': 0x8c959f }

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio))
renderer.setSize(W(), H())
root.prepend(renderer.domElement)
const scene = new THREE.Scene()
scene.add(new THREE.AmbientLight(0xffffff, 0.9))
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(1, 3, 2); scene.add(sun)
const camera = new THREE.PerspectiveCamera(45, W() / H(), 1, 6000)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const bg = new THREE.Color()
function theme() {
  bg.set(css('--bg') || '#0d1117'); scene.background = bg
  grid.material.color.set(css('--grid') || '#21262d')
}
const groups = { solution: new THREE.Group(), evidence: new THREE.Group() }
scene.add(groups.solution, groups.evidence)
const grid = new THREE.GridHelper(720, 18)
grid.position.y = -302; grid.material.transparent = true; grid.material.opacity = 0.5
groups.evidence.add(grid)
theme()
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme)

// --- solution layer: one InstancedMesh per (shape, style) --------------------------------------
const GEO = {
  goal: new THREE.TorusGeometry(0.8, 0.32, 12, 32), circle: new THREE.SphereGeometry(1, 20, 14),
  square: new THREE.BoxGeometry(1.5, 1.5, 1.5), triangle: new THREE.ConeGeometry(1, 1.8, 3),
  diamond: new THREE.OctahedronGeometry(1.2), hex: new THREE.CylinderGeometry(1, 1, 0.9, 6),
  cross: new THREE.TetrahedronGeometry(1.3), question: new THREE.IcosahedronGeometry(1.1, 0),
}
const style = (n) => (n.s === 'abandoned' ? 'faded' : n.s === 'open' ? 'wire' : 'solid')
const buckets = new Map()
D.solution.forEach((n, i) => {
  const key = n.sh + '|' + style(n)
  if (!buckets.has(key)) buckets.set(key, [])
  buckets.get(key).push(i)
})
const solMeshes = [], solRef = []
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
for (const [key, idx] of buckets) {
  const [shape, st] = key.split('|')
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, wireframe: st === 'wire', transparent: st === 'faded', opacity: st === 'faded' ? 0.2 : 1, depthWrite: st !== 'faded' })
  const mesh = new THREE.InstancedMesh(GEO[shape], mat, idx.length)
  idx.forEach((i, j) => {
    const n = D.solution[i]
    col.setHex(D.colors[n.k] ?? 0x888888)
    if (n.w < 0.5 && n.s !== 'abandoned') col.lerp(bg, 0.45)
    mesh.setColorAt(j, col)
    solRef[i] = { mesh, j }
  })
  mesh.userData.idx = idx
  groups.solution.add(mesh); solMeshes.push(mesh)
}
const grow = new Float32Array(D.solution.length).fill(1)
function placeSol(i) {
  const n = D.solution[i], s = n.r * grow[i], ref = solRef[i]
  q.copy(n.sh === 'goal' ? tilt : new THREE.Quaternion())
  m4.compose(v3.set(n.p[0], n.p[1], n.p[2]), q, sc.set(s || 1e-4, s || 1e-4, s || 1e-4))
  ref.mesh.setMatrixAt(ref.j, m4)
  ref.mesh.instanceMatrix.needsUpdate = true
}

// Health rings: billboarded circles at r + 3 (solid / dashed / thin grey).
const ringGeo = (() => { const pts = []; for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)) } return new THREE.BufferGeometry().setFromPoints(pts) })()
const rings = D.solution.map((n, i) => {
  const mat = n.h === 'compacted' ? new THREE.LineDashedMaterial({ color: HEALTH[n.h], dashSize: 0.12, gapSize: 0.1 }) : new THREE.LineBasicMaterial({ color: HEALTH[n.h], transparent: true, opacity: n.h === 'in-window' ? 0.95 : 0.5 })
  const ring = new THREE.Line(ringGeo, mat)
  if (n.h === 'compacted') ring.computeLineDistances()
  if (n.s === 'abandoned') { mat.transparent = true; mat.opacity = 0.15 }
  ring.position.set(n.p[0], n.p[1], n.p[2]); ring.userData = { n, i }
  groups.solution.add(ring)
  return ring
})

// --- evidence layer ---------------------------------------------------------------------------
const evR = (t) => Math.max(1.6, Math.min(6, 0.16 * Math.sqrt(Math.max(1, t))))
const evMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.6 }), Math.max(1, D.evidence.length))
D.evidence.forEach((n, i) => {
  const r = evR(n.t) * (1 + 0.5 * n.w)
  evMesh.setMatrixAt(i, m4.makeScale(r, r, r).setPosition(n.p[0], n.p[1], n.p[2]))
  col.setHex(D.colors[n.k] ?? 0x888888).lerp(bg, n.w > 0 ? 0.1 : n.o ? 0.8 : 0.5)
  evMesh.setColorAt(i, col)
})
evMesh.count = D.evidence.length
groups.evidence.add(evMesh)
{
  const pos = new Float32Array(D.eedges.length * 6)
  D.eedges.forEach(([a, b], i) => pos.set([...D.evidence[a].p, ...D.evidence[b].p], i * 6))
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  groups.evidence.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8c959f, transparent: true, opacity: 0.25 })))
}

// --- solution edges by kind; supported-by is dotted and drops to the evidence layer -------------
const supportLines = []
for (const kind of Object.keys(EDGE)) {
  const es = D.sedges.filter((e) => e[2] === kind)
  if (!es.length) continue
  const pos = new Float32Array(es.length * 6)
  es.forEach(([a, b, , toEv], i) => pos.set([...D.solution[a].p, ...(toEv ? D.evidence[b] : D.solution[b]).p], i * 6))
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dashed = kind === 'contradicts' || kind === 'supported-by'
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color: EDGE[kind], dashSize: kind === 'contradicts' ? 8 : 2, gapSize: kind === 'contradicts' ? 5 : 5, transparent: true, opacity: kind === 'supported-by' ? 0.25 : 0.95 })
    : new THREE.LineBasicMaterial({ color: EDGE[kind], transparent: true, opacity: 0.9 })
  const line = new THREE.LineSegments(g, mat)
  if (dashed) line.computeLineDistances()
  if (kind === 'supported-by') { supportLines.push(line); scene.add(line) } else groups.solution.add(line)
  if (kind === 'constrains') { // arrowheads at the target end
    es.forEach(([a, b]) => {
      const A = new THREE.Vector3(...D.solution[a].p), B = new THREE.Vector3(...D.solution[b].p), dir = B.clone().sub(A)
      const len = dir.length(); if (len < 1) return
      dir.normalize()
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 8), new THREE.MeshBasicMaterial({ color: EDGE.constrains }))
      cone.position.copy(B.clone().addScaledVector(dir, -(D.solution[b].r + 6)))
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      groups.solution.add(cone)
    })
  }
}

// --- HUD ----------------------------------------------------------------------------------------
const hex = (c) => '#' + c.toString(16).padStart(6, '0')
document.getElementById('cg-header').textContent = D.header + (D.note ? ' · ' + D.note : '')
document.getElementById('cg-legend').innerHTML = D.kinds.map((k) => '<span><b style="color:' + hex(D.colors[k]) + '">' + GLYPH[k] + '</b>' + k + '</span>').join('') +
  '<span><b style="color:' + hex(HEALTH['in-window']) + '">○</b>in window</span><span><b style="color:' + hex(HEALTH.compacted) + '">◌</b>compacted</span><span><b style="color:' + hex(HEALTH['never-loaded']) + '">·</b>never loaded</span>'
const oq = document.getElementById('cg-oq')
const openQs = D.solution.map((n, i) => [n, i]).filter(([n]) => n.k === 'question' && n.s === 'open')
for (const [n, i] of openQs) {
  const b = document.createElement('button'); b.type = 'button'
  b.style.color = hex(D.colors.question)
  b.textContent = '? ' + n.l
  b.addEventListener('click', () => flyTo(frameOf([n.p], n.r * 6)))
  oq.appendChild(b)
}

// Labels: goal, open questions, components, decisions, constraints/risks, other factors; abandoned last (cap 24)
// + 6 strongest evidence nodes.
const RANK = { goal: 0, question: 1, component: 2, decision: 3, constraint: 4, risk: 4, requirement: 5, assumption: 5, dependency: 5 }
const labelSol = D.solution.filter((n) => RANK[n.k] !== undefined && (n.k !== 'question' || n.s === 'open'))
  .sort((a, b) => (a.s === 'abandoned') - (b.s === 'abandoned') || RANK[a.k] - RANK[b.k] || b.w - a.w).slice(0, 24)
const labelEv = D.evidence.filter((n) => n.w > 0).sort((a, b) => b.w - a.w || b.t - a.t).slice(0, 6)
const tags = [...labelSol.map((n) => ({ n, sol: true })), ...labelEv.map((n) => ({ n, sol: false }))].map(({ n, sol }) => {
  const i = sol ? D.solution.indexOf(n) : -1, ei = sol ? -1 : D.evidence.indexOf(n)
  const el = document.createElement('div')
  el.className = 'cg-tag ' + (sol ? 'sol ' + n.k + (n.s === 'abandoned' ? ' abandoned' : '') : 'ev')
  if (sol) el.style.color = hex(D.colors[n.k])
  el.textContent = sol ? GLYPH[n.k] + ' ' + n.l : n.l
  root.appendChild(el)
  const lead = sol ? root.appendChild(Object.assign(document.createElement('div'), { className: 'cg-lead' })) : null
  return { n, sol, i, ei, el, lead, v: new THREE.Vector3() }
})
// Every node's on-screen marker (solution nodes with their health ring), so labels never cover a node.
const mv = new THREE.Vector3(), right = new THREE.Vector3()
let markers = [], labelHits = 0
function screenMarkers(w0, h0) {
  right.setFromMatrixColumn(camera.matrixWorld, 0)
  const out = [], add = (p, r, sol, i) => {
    mv.set(p[0], p[1], p[2]).project(camera)
    if (mv.z >= 1) return
    const x = (mv.x + 1) / 2 * w0, y = (1 - mv.y) / 2 * h0
    mv.set(p[0], p[1], p[2]).addScaledVector(right, r).project(camera)
    out.push({ x, y, r: Math.hypot((mv.x + 1) / 2 * w0 - x, (1 - mv.y) / 2 * h0 - y) + 2, sol, i })
  }
  if (groups.solution.visible) D.solution.forEach((n, i) => { if (grow[i] > 0.5) add(n.p, (n.r + 3) * grow[i], true, i) })
  if (groups.evidence.visible) D.evidence.forEach((n, j) => add(n.p, evR(n.t) * (1 + 0.5 * n.w), false, j))
  return out
}
const hitsMarker = (x, y, w, h, m) => Math.hypot(Math.max(x, Math.min(m.x, x + w)) - m.x, Math.max(y, Math.min(m.y, y + h)) - m.y) < m.r
function placeTags() {
  const w0 = W(), h0 = H(), rr = root.getBoundingClientRect()
  markers = screenMarkers(w0, h0); labelHits = 0
  // the HUD and the buttons are occupied space too
  const boxes = [...root.querySelectorAll('#cg-header, #cg-legend, #cg-oq button, #cg-buttons')].map((el) => {
    const b = el.getBoundingClientRect()
    return { x: b.left - rr.left, y: b.top - rr.top, w: b.width, h: b.height }
  })
  for (const t of tags) {
    const layerOn = t.sol ? groups.solution.visible : groups.evidence.visible
    const i = t.i
    t.v.set(...t.n.p).project(camera)
    const px = (t.v.x + 1) / 2 * w0, py = (1 - t.v.y) / 2 * h0, h = 16
    const own = markers.find((m) => m.sol === t.sol && m.i === (t.sol ? i : t.ei)), gap = t.sol ? Math.max(10, (own?.r ?? 0) + 4) : 6
    const ew = t.el.offsetWidth || 120
    // right, left, above, below, then the four diagonals: the first spot that is on screen and free
    const spots = [[px + gap, py - 8], [px - gap - ew, py - 8], [px - ew / 2, py - gap - h], [px - ew / 2, py + gap - 4], [px + gap, py - 8 - h], [px + gap, py + 6], [px - gap - ew, py - 8 - h], [px - gap - ew, py + 6]]
    // solution labels are never dropped: step further out a line at a time, with a leader back to the node
    if (t.sol) for (let k = 2; k <= 30; k++) for (const dy of [-k * h, k * h]) spots.push([px + gap, py - 8 + dy], [px - gap - ew, py - 8 + dy])
    let si = -1
    // solution labels avoid every other node's marker, then only solution markers, then labels only;
    // evidence labels avoid every other node's marker or are dropped
    const near = markers.filter((m) => m !== own && Math.abs(m.x - px) < ew + gap + m.r + 4 && Math.abs(m.y - py) < 32 * h + m.r)
    const tiers = t.sol ? [near, near.filter((m) => m.sol), []] : [near]
    const live = layerOn && (i < 0 || grow[i] > 0.5) && t.v.z < 1 && Math.abs(t.v.x) < 1 && Math.abs(t.v.y) < 1
    let x = px + gap, y = py - 8, w = Math.min(ew, w0 - x), on = false
    if (live) for (const obst of tiers) {
      for (const [j, [sx, sy]] of spots.entries()) {
        const sw = Math.min(ew, w0 - sx)
        if (sx < 0 || sx > w0 - 24 || sy < 0 || sy > h0 - h) continue
        if (boxes.some((b) => sx < b.x + b.w && b.x < sx + sw && sy < b.y + (b.h ?? h) && b.y < sy + h)) continue
        if (obst.some((m) => hitsMarker(sx, sy, sw, h, m))) continue
        x = sx; y = sy; w = sw; on = true; si = j; break
      }
      if (on) break
    }
    if (on) boxes.push({ x, y, w, h })
    if (on && markers.some((m) => m !== own && hitsMarker(x, y, w, h, m))) labelHits++
    t.el.style.display = on ? 'block' : 'none'
    t.el.style.maxWidth = Math.max(40, w0 - x - 8) + 'px'
    t.el.style.transform = 'translate(' + x + 'px,' + y + 'px)'
    if (t.lead) {
      const far = on && si >= 4, lx = x > px ? x - 1 : x + w + 1, ly = y + h / 2
      t.lead.style.display = far ? 'block' : 'none'
      if (far) { t.lead.style.width = Math.hypot(lx - px, ly - py) + 'px'; t.lead.style.transform = 'translate(' + px + 'px,' + py + 'px) rotate(' + Math.atan2(ly - py, lx - px) + 'rad)' }
    }
  }
}

// --- camera -------------------------------------------------------------------------------------
const DIR = new THREE.Vector3(0.35, 0.62, 1).normalize()
function frameOf(points, minR) {
  const c = new THREE.Vector3()
  points.forEach((p) => c.add(new THREE.Vector3(...p)))
  if (points.length) c.divideScalar(points.length)
  let r = minR || 40
  points.forEach((p) => { r = Math.max(r, c.distanceTo(new THREE.Vector3(...p)) + 12) })
  const vf = (camera.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * camera.aspect)
  const d = (r / Math.sin(Math.min(vf, hf))) * 1.02
  return { target: c, eye: c.clone().addScaledVector(DIR, d) }
}
function visiblePoints() {
  const pts = []
  if (groups.solution.visible) D.solution.forEach((n) => pts.push(n.p))
  if (groups.evidence.visible) D.evidence.forEach((n) => pts.push(n.p))
  return pts.length ? pts : [[0, 0, 0]]
}
let tween = null
function flyTo(f, instant) {
  if (instant) { camera.position.copy(f.eye); controls.target.copy(f.target); controls.update(); return }
  tween = { t0: performance.now(), fromE: camera.position.clone(), fromT: controls.target.clone(), ...f }
}
// Overview: start from the bounding sphere, then pan and dolly a few times so the projected extent fills the
// view (x in [-0.94, 0.94], y in [-0.9, 0.7]: the top strip is left to the HUD).
const _v = new THREE.Vector3(), _probe = new THREE.PerspectiveCamera()
function overview() {
  const pts = visiblePoints(), f = frameOf(pts)
  for (let it = 0; it < 6; it++) {
    _probe.copy(camera); _probe.position.copy(f.eye); _probe.lookAt(f.target); _probe.updateMatrixWorld()
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const p of pts) { _v.set(...p).project(_probe); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y) }
    const d = f.eye.distanceTo(f.target), hy = Math.tan((camera.fov * Math.PI) / 360) * d, hx = hy * camera.aspect
    const right = new THREE.Vector3().setFromMatrixColumn(_probe.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(_probe.matrixWorld, 1)
    const shift = right.multiplyScalar(((x0 + x1) / 2) * hx).add(up.multiplyScalar(((y0 + y1) / 2 + 0.1) * hy))
    f.target.add(shift); f.eye.add(shift)
    const k = Math.max((x1 - x0) / 1.88, (y1 - y0) / 1.6, 0.3)
    f.eye.copy(f.target).addScaledVector(DIR, d * (0.5 + 0.5 * k))
  }
  return f
}
flyTo(overview(), true)
document.getElementById('cg-focus').addEventListener('click', () => {
  const ids = new Set(D.focus)
  const pts = D.solution.filter((n) => ids.has(n.id)).map((n) => n.p)
  flyTo(pts.length ? frameOf(pts, 60) : overview())
})
const ORDER = ['both', 'solution', 'evidence']
let layers = 'both'
const layersBtn = document.getElementById('cg-layers')
layersBtn.addEventListener('click', () => {
  layers = ORDER[(ORDER.indexOf(layers) + 1) % 3]
  groups.solution.visible = layers !== 'evidence'
  groups.evidence.visible = layers !== 'solution'
  supportLines.forEach((l) => { l.visible = layers === 'both' })
  layersBtn.textContent = 'layers: ' + layers
  flyTo(overview())
})

// --- growth: new nodes grow in on load; replay re-grows the whole model in createdSeq order -------
let anim = null
function startGrow(list, span) {
  const t0 = performance.now()
  list.forEach((i) => { grow[i] = 0; placeSol(i) })
  anim = { t0, starts: new Map(list.map((i, k) => [i, list.length > 1 ? (k / (list.length - 1)) * span : 0])) }
}
const freshIdx = D.solution.map((n, i) => [n, i]).filter(([n]) => n.c > D.since).map(([, i]) => i)
D.solution.forEach((_, i) => placeSol(i))
if (freshIdx.length) startGrow(freshIdx, 0)
let replaying = false
document.getElementById('cg-replay').addEventListener('click', () => {
  replaying = true
  startGrow(D.solution.map((_, i) => i), 3400)
})
function stepGrow(now) {
  if (!anim) return
  let done = true
  for (const [i, s] of anim.starts) {
    const k = Math.max(0, Math.min(1, (now - anim.t0 - s) / 600))
    const e = k < 1 ? 1 - Math.pow(1 - k, 3) : 1
    if (e !== grow[i]) { grow[i] = e; placeSol(i) }
    rings[i].visible = e > 0.95
    if (k < 1) done = false
  }
  if (done) { anim = null; replaying = false }
}

// --- hover tooltip --------------------------------------------------------------------------------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = document.getElementById('cg-tip')
const solTip = (n) => n.k + ' · ' + n.s + ' · ' + n.l + ' · health ' + n.h + ' (' + n.hc.join('/') + ') · relevance ' + n.w.toFixed(2) + (n.why ? ' · ' + n.why : '')
root.addEventListener('pointermove', (ev) => {
  const rect = root.getBoundingClientRect()
  mouse.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
  ray.setFromCamera(mouse, camera)
  const targets = [...(groups.solution.visible ? solMeshes : []), ...(groups.evidence.visible ? [evMesh] : [])]
  const hit = ray.intersectObjects(targets, false)[0]
  let text = ''
  if (hit && hit.instanceId !== undefined) {
    if (hit.object === evMesh) { const n = D.evidence[hit.instanceId]; text = n.k + ' · ' + n.l + ' · ' + n.t + ' tok' + (n.o ? ' · compacted' : '') }
    else text = solTip(D.solution[hit.object.userData.idx[hit.instanceId]])
  }
  if (text) {
    tip.textContent = text; tip.style.display = 'block'
    tip.style.left = Math.min(ev.clientX - rect.left + 12, rect.width - tip.offsetWidth - 16) + 'px'; tip.style.top = ev.clientY - rect.top + 12 + 'px'
  } else tip.style.display = 'none'
})
function resize() { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()) }
addEventListener('resize', resize)

// Read-only probe for tests.
const visibleInstances = () => (groups.solution.visible ? D.solution.length : 0) + (groups.evidence.visible ? D.evidence.length : 0)
window.__cg = window.__cg || {}
Object.defineProperties(window.__cg, {
  solutionNodes: { get: () => D.solution.length, enumerable: true },
  evidenceNodes: { get: () => D.evidence.length, enumerable: true },
  openQuestions: { get: () => openQs.length, enumerable: true },
  layers: { get: () => layers, enumerable: true },
  replaying: { get: () => replaying, enumerable: true },
  visibleMeshes: { get: () => visibleInstances(), enumerable: true },
  frames: { get: () => frames, enumerable: true },
  solLabels: { get: () => tags.filter((t) => t.sol && t.el.style.display === 'block').length, enumerable: true },
  labelHits: { get: () => labelHits, enumerable: true },
})

let frames = 0
renderer.setAnimationLoop((now) => {
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / 700), e = k * k * (3 - 2 * k)
    camera.position.lerpVectors(tween.fromE, tween.eye, e); controls.target.lerpVectors(tween.fromT, tween.target, e)
    if (k >= 1) tween = null
  }
  stepGrow(now)
  controls.update()
  for (const r of rings) { r.quaternion.copy(camera.quaternion); const s = (r.userData.n.r + 3) * grow[r.userData.i]; r.scale.setScalar(Math.max(1e-4, s)) }
  renderer.render(scene, camera)
  placeTags()
  frames++
})
}
`

// ---------------------------------------------------------------------------------------------
// v3 (design.md 4.8): the UML tab. Mermaid classDiagram per timeline step, re-rendered on every
// step or theme change; a static renderUmlSvg fallback (both themes) when Mermaid cannot load.

const esc = escapeXml
const STATIC_SIZE = { w: 1200, h: 800 }

interface UmlSectionData {
  steps: UmlPageData['steps']
  latest: UmlPageData['latest'] | null
  counts: UmlPageData['counts'] | null
  scan: UmlPageData['scan']
  /** element id -> display name (intended + unplanned at the latest step) */
  info: Record<string, string>
  static: { dark: string; light: string } | null
}

function umlSection(page: UmlPageData | undefined, tab: 'uml' | '3d'): { html: string; data: UmlSectionData } {
  void tab
  if (!page || !page.steps.length) {
    return {
      html: '<div class="cg-empty">No UML yet: Claude records it with context_graph uml.add, each change citing a decision.</div>',
      data: { steps: [], latest: null, counts: null, scan: null, info: {}, static: null },
    }
  }
  const d = page.latestDiagram
  const lay = layoutUml(d, STATIC_SIZE)
  // inline SVG in HTML needs no xmlns; dropping it keeps the page's only remote URLs the CDN ones
  const svg = (theme: 'dark' | 'light') => renderUmlSvg(lay, d, { width: STATIC_SIZE.w, height: STATIC_SIZE.h, theme }).replace(' xmlns="http://www.w3.org/2000/svg"', '')
  const info: Record<string, string> = {}
  for (const e of d.elements) info[e.id] = e.name
  const n = page.steps.length
  const html = `<div id="cg-counts"></div>
<div id="cg-controls"><button type="button" id="cg-prev" aria-label="previous decision">◀</button><input type="range" id="cg-step" min="1" max="${n}" value="${n}" step="1" aria-label="decision step"><button type="button" id="cg-next" aria-label="next decision">▶</button><button type="button" id="cg-play" aria-label="play">⏵</button><span id="cg-caption"></span></div>
<div id="cg-chips"></div>
<div id="cg-main"><div id="cg-diagram"><div id="uml"></div><div id="cg-note"></div></div>
<aside id="cg-side"><div id="cg-decision"></div><label class="cg-unplanned">built, not planned: <select id="cg-unplanned"><option value="components">components</option><option value="all">all</option><option value="none">none</option></select></label><div id="cg-check"></div></aside></div>`
  return {
    html,
    data: { steps: page.steps, latest: page.latest, counts: page.counts, scan: page.scan, info, static: { dark: svg('dark'), light: svg('light') } },
  }
}

const UL = UML_COLORS.light, UD = UML_COLORS.dark
const umlTokens = (c: typeof UL | typeof UD, node: string, line: string) =>
  `--tabs-h:40px;--node:${node};--line:${line};--accent:${c.accent};--f-match:${c.flag.matching};--f-planned:${c.flag['planned-not-built']};--f-built:${c.flag['built-not-planned']};--f-stale:${c.flag['removed-but-built']};--k-component:${c.kind.component};--k-class:${c.kind.class};--k-interface:${c.kind.interface}`
const UML_CSS = `
:root{${umlTokens(UL, '#f6f8fa', '#57606a')}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${umlTokens(UD, '#161b22', '#8b949e')}}}
:root[data-theme="dark"]{${umlTokens(UD, '#161b22', '#8b949e')}}
[hidden]{display:none !important}
#cg-tabs{position:fixed;top:0;left:0;right:0;height:var(--tabs-h);box-sizing:border-box;display:flex;gap:6px;align-items:center;padding:0 16px;background:var(--bg);border-bottom:1px solid var(--border);z-index:3;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
#cg-tabs button{font:inherit;color:var(--muted);background:none;border:1px solid transparent;border-radius:6px;padding:5px 10px;cursor:pointer}
#cg-tabs button[aria-selected="true"]{color:var(--fg);border-color:var(--border);background:var(--panel);font-weight:600}
#cg-panel-uml{position:fixed;top:var(--tabs-h);left:0;right:0;bottom:0;overflow:auto;box-sizing:border-box;padding:10px 16px 16px;background:var(--bg);color:var(--fg);font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
.cg-empty{margin:48px auto;max-width:52ch;text-align:center;color:var(--muted)}
#cg-counts{font-weight:600;font-size:13px;overflow-wrap:anywhere}
#cg-counts .f{margin-right:10px;white-space:nowrap}#cg-counts .scan{font-weight:normal;color:var(--muted)}
#cg-controls{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}
#cg-controls button,#cg-side select{font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:3px 9px;cursor:pointer}
#cg-step{flex:1 1 160px;min-width:0;accent-color:var(--accent)}
#cg-caption{flex:1 1 100%;color:var(--muted);overflow-wrap:anywhere}
#cg-chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.cg-chip{border:1px solid var(--border);border-radius:10px;padding:1px 8px;max-width:100%;overflow-wrap:anywhere}
.cg-chip.added{border-color:var(--accent)}.cg-chip.changed{border-color:var(--accent);border-style:dashed}.cg-chip.removed{border-color:var(--f-stale);text-decoration:line-through}
#cg-main{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
#cg-diagram{flex:3 1 480px;min-width:0;max-width:100%;max-height:max(320px,calc(100vh - 190px));overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg)}
#uml{min-height:200px;padding:8px}#uml svg{display:block;height:auto}#uml svg.cg-static,#uml > svg[viewBox]:not([id]){max-width:100%}
#cg-note{color:var(--muted);padding:0 8px 6px}#cg-note:empty{display:none}
#cg-side{flex:1 1 240px;min-width:0;max-width:100%;overflow-wrap:anywhere}
#cg-side h3{font-size:12px;margin:10px 0 4px}#cg-side ul{margin:0;padding-left:16px}
#cg-side li button{font:inherit;color:var(--fg);background:none;border:0;padding:0;cursor:pointer;text-align:left;text-decoration:underline dotted}
#cg-decision .label{font-weight:600}#cg-decision .detail{color:var(--muted)}
.cg-unplanned{display:block;margin-top:8px;color:var(--muted)}
#uml g[data-cg-id] .label-container path,#uml g[data-cg-id] .label-container rect{stroke:var(--line) !important;stroke-width:1.2px !important}
#uml g[data-cg-flag="matching"] .label-container path,#uml g[data-cg-flag="matching"] .label-container rect{stroke:var(--f-match) !important;stroke-dasharray:none !important}
#uml g[data-cg-flag="planned-not-built"] .label-container path,#uml g[data-cg-flag="planned-not-built"] .label-container rect{stroke:var(--f-planned) !important;stroke-dasharray:5 3 !important}
#uml g[data-cg-flag="built-not-planned"] .label-container path,#uml g[data-cg-flag="built-not-planned"] .label-container rect{stroke:var(--f-built) !important;stroke-dasharray:1 3 !important}
#uml g[data-cg-flag="removed-but-built"] .label-container path,#uml g[data-cg-flag="removed-but-built"] .label-container rect{stroke:var(--f-stale) !important}
#uml g[data-cg-status="removed"],#uml g[data-cg-status="abandoned"]{opacity:.5}
#uml g[data-cg-status="removed"] .label-container path,#uml g[data-cg-status="abandoned"] .label-container path{stroke-dasharray:4 3 !important}
#uml g[data-cg-status="removed"] .label-group,#uml g[data-cg-status="removed"] .label-group *,#uml g[data-cg-status="abandoned"] .label-group,#uml g[data-cg-status="abandoned"] .label-group *{text-decoration:line-through !important}
#uml g[data-cg-change="added"] .label-container path,#uml g[data-cg-change="added"] .label-container rect{stroke:var(--accent) !important;stroke-width:3px !important}
#uml g[data-cg-change="changed"] .label-container path,#uml g[data-cg-change="changed"] .label-container rect{stroke:var(--accent) !important;stroke-width:2.5px !important;stroke-dasharray:6 3 !important}
#uml g[data-cg-change="removed"] .label-container path,#uml g[data-cg-change="removed"] .label-container rect{stroke:var(--f-stale) !important;stroke-width:3px !important}
#uml g.cg-pulse{animation:cg-pulse .6s ease-in-out 3}
@keyframes cg-pulse{50%{opacity:.25}}
@media (max-width:600px){#cg-diagram{flex-basis:100%}}
`

// Browser-side module for the UML tab. MERMAID_URL is prepended by exportSolutionHtml ('' = no UML).
const UML_CLIENT = String.raw`
const U = JSON.parse(document.getElementById('cg-uml').textContent)
const $ = (id) => document.getElementById(id)
const FLAGS = ['matching', 'planned-not-built', 'built-not-planned', 'removed-but-built', 'unchecked']
const CHANGES = ['added', 'changed', 'removed']
const SYM = { matching: '✓', 'planned-not-built': '◌', 'built-not-planned': '+', 'removed-but-built': '!', unchecked: '?' }
const TITLE = { matching: 'matching', 'planned-not-built': 'planned, not built', 'built-not-planned': 'built, not planned', 'removed-but-built': 'removed, still built', unchecked: 'unchecked' }
const zero = (keys) => Object.fromEntries(keys.map((k) => [k, 0]))
const N = U.steps.length
const probe = { step: N, steps: N, rendered: false, nodes: 0, flags: zero(FLAGS), changes: zero(CHANGES), fallback: false }
let tab = document.querySelector('[role=tab][aria-selected="true"]')?.dataset.tab || 'uml'
window.__cg = window.__cg || {}
Object.defineProperties(window.__cg, {
  uml: { get: () => ({ ...probe, flags: { ...probe.flags }, changes: { ...probe.changes } }), enumerable: true },
  tab: { get: () => tab, enumerable: true },
})

// --- tabs (wired before anything can fail) -------------------------------------------------------
function show(t) {
  tab = t
  for (const b of document.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === t))
  $('cg-panel-uml').hidden = t !== 'uml'
  $('cg-root').hidden = t !== '3d'
  dispatchEvent(new Event('cg-tab'))
}
for (const b of document.querySelectorAll('[role=tab]')) b.addEventListener('click', () => show(b.dataset.tab))

if (N) {
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
  const theme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  let step = N, unplanned = 'components', timer = null, seq = 0, renders = 0, mermaidP = null
  const variant = () => (step === N ? U.latest[unplanned] : U.steps[step - 1])
  const nameOf = (id) => {
    if (U.info[id]) return U.info[id]
    if (id.includes('|')) { const [a, k, b] = id.split('|'); return nameOf(a) + ' ' + k + ' ' + nameOf(b) }
    const dot = id.lastIndexOf('.')
    if (dot > 0 && U.info[id.slice(0, dot)]) return U.info[id.slice(0, dot)] + '.' + id.slice(dot + 1)
    return id.startsWith('code:') ? id.slice(id.lastIndexOf('/') + 1) : id
  }
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e }

  // header counts (latest step, vs the code as scanned)
  {
    const h = $('cg-counts')
    for (const f of FLAGS) { const s = el('span', SYM[f] + ' ' + (U.counts[f] || 0), 'f'); s.title = TITLE[f]; h.appendChild(s) }
    if (U.scan) {
      const at = U.scan.at ? new Date(U.scan.at).toTimeString().slice(0, 8) : 'not yet'
      h.appendChild(el('span', 'vs code scanned ' + at + ' (' + U.scan.root + ')' + (U.scan.truncated ? ' · truncated' : ''), 'scan'))
    }
  }

  function pulse(id) {
    const g = $('uml').querySelector('[data-cg-id="' + CSS.escape(id) + '"], g.uml-box[data-id="' + CSS.escape(id) + '"]')
    if (!g) return
    g.classList.remove('cg-pulse'); void g.getBBox?.(); g.classList.add('cg-pulse')
    setTimeout(() => g.classList.remove('cg-pulse'), 2000)
  }

  function chrome() {
    const s = U.steps[step - 1], v = variant()
    probe.step = step
    $('cg-step').value = String(step)
    $('cg-prev').disabled = step <= 1
    $('cg-next').disabled = step >= N
    $('cg-unplanned').disabled = step !== N
    $('cg-caption').textContent = 'Step ' + step + ' of ' + N + ' · ' + s.label
    const chips = $('cg-chips'); chips.replaceChildren()
    for (const k of CHANGES) for (const t of s.changes[k]) chips.appendChild(el('span', k + ': ' + nameOf(t), 'cg-chip ' + k))
    const dec = $('cg-decision'); dec.replaceChildren()
    dec.appendChild(el('div', s.label, 'label'))
    if (s.detail) dec.appendChild(el('div', s.detail, 'detail'))
    if (s.drivenBy.length) dec.appendChild(el('div', 'driven by: ' + s.drivenBy.join(' · '), 'detail'))
    const check = $('cg-check'); check.replaceChildren()
    const by = {}
    // marks are keyed by Mermaid class name
    for (const [id, name] of Object.entries(v.names)) { const m = v.marks[name]; if (m && m.flag && m.flag !== 'matching') (by[m.flag] ||= []).push(id) }
    // planned members of built elements (pulse their element)
    for (const [id, ms] of Object.entries(v.pending || {})) for (const mn of ms) (by['planned-not-built'] ||= []).push(id + '.' + mn)
    for (const f of ['planned-not-built', 'built-not-planned', 'removed-but-built', 'unchecked']) {
      if (!by[f]) continue
      check.appendChild(el('h3', SYM[f] + ' ' + TITLE[f] + ' (' + by[f].length + ')'))
      const ul = el('ul')
      for (const id of by[f]) {
        const li = el('li'), b = el('button', id.startsWith('code:') ? id.slice(5) : nameOf(id)), owner = v.names[id] ? id : id.slice(0, id.lastIndexOf('.'))
        b.type = 'button'; b.addEventListener('click', () => pulse(owner)); li.appendChild(b); ul.appendChild(li)
      }
      check.appendChild(ul)
    }
    if (!check.childNodes.length) check.appendChild(el('div', '✓ everything recorded matches the code', 'detail'))
  }

  function countDom(attrFlag, attrChange, sel) {
    probe.flags = zero(FLAGS); probe.changes = zero(CHANGES)
    const nodes = $('uml').querySelectorAll(sel)
    for (const g of nodes) {
      const f = g.getAttribute(attrFlag), c = g.getAttribute(attrChange)
      if (f in probe.flags) probe.flags[f]++
      if (c in probe.changes) probe.changes[c]++
    }
    probe.nodes = nodes.length
  }

  function mark(v) {
    const root = $('uml')
    for (const [id, name] of Object.entries(v.names)) {
      const g = root.querySelector('g[id^="classId-' + name + '-"]')
      if (!g) continue
      const m = v.marks[name] || { flag: null, status: 'active', change: null }
      g.setAttribute('data-cg-id', id)
      g.setAttribute('data-cg-flag', m.flag || 'none')
      g.setAttribute('data-cg-status', m.status)
      g.setAttribute('data-cg-change', m.change || 'none')
    }
    countDom('data-cg-flag', 'data-cg-change', 'g[data-cg-id]')
  }

  function fallback(e) {
    probe.fallback = true; probe.rendered = false; probe.error = String(e && e.message || e).slice(0, 200)
    $('uml').innerHTML = U.static[theme()] || U.static.light
    $('cg-note').textContent = 'Mermaid could not load: static diagram (latest step)'
    countDom('data-flag', 'data-change', 'g.uml-box')
  }

  function loadMermaid() {
    mermaidP ||= import(MERMAID_URL).then((m) => m.default || m)
    return mermaidP
  }

  async function render() {
    chrome()
    const my = ++seq, v = variant()
    probe.rendered = false
    if (probe.fallback) { fallback(probe.error); return }
    try {
      const mermaid = await loadMermaid()
      if (my !== seq) return
      const dark = theme() === 'dark'
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', darkMode: dark, themeVariables: {
        darkMode: dark, background: css('--bg'), primaryColor: css('--node'), mainBkg: css('--node'), primaryTextColor: css('--fg'),
        classText: css('--fg'), textColor: css('--fg'), primaryBorderColor: css('--line'), nodeBorder: css('--line'), lineColor: css('--line'),
        secondaryColor: css('--node'), tertiaryColor: css('--bg'), fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '13px' } })
      const id = 'cg-uml-' + (++renders)
      let out
      try { out = await mermaid.render(id, v.mermaid) } finally { document.getElementById('d' + id)?.remove() }
      if (my !== seq) return
      $('uml').innerHTML = out.svg
      // fit the width, but never below 60 % of Mermaid's natural size: #cg-diagram scrolls rather than shrink the text
      const svgEl = $('uml').querySelector('svg')
      if (svgEl && svgEl.style.maxWidth) {
        const natural = parseFloat(svgEl.style.maxWidth) || 0, fit = $('cg-diagram').clientWidth - 18
        svgEl.style.width = Math.round(Math.min(natural, Math.max(fit, natural * 0.6))) + 'px'
        svgEl.style.maxWidth = 'none'; svgEl.removeAttribute('width')
      }
      $('cg-note').textContent = ''
      mark(v)
      probe.rendered = true
      delete probe.error
    } catch (e) {
      if (my === seq) fallback(e)
    }
  }

  const go = (k) => { const n = Math.max(1, Math.min(N, k)); if (n !== step) { step = n; render() } }
  $('cg-step').addEventListener('input', (e) => go(Number(e.target.value)))
  $('cg-prev').addEventListener('click', () => go(step - 1))
  $('cg-next').addEventListener('click', () => go(step + 1))
  $('cg-unplanned').addEventListener('change', (e) => { unplanned = e.target.value; render() })
  const stop = () => { clearInterval(timer); timer = null; $('cg-play').textContent = '⏵' }
  $('cg-play').addEventListener('click', () => {
    if (timer) return stop()
    if (step >= N) go(1)
    $('cg-play').textContent = '⏸'
    timer = setInterval(() => (step >= N ? stop() : go(step + 1)), 1200)
  })
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render)
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  render()
}
`
