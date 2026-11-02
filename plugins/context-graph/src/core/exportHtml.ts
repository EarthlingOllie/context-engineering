// exportHtml: Graph + positions + blast -> one self-contained three.js WebGL page (design.md 4.7).
// Runs in a browser, not the pane; uses the same positions as the pane so both views match.
import { KIND_COLORS } from './scene.ts'
import { escapeXml } from './svg.ts'
import type { BlastRadius, Graph, Vec3 } from './types.ts'

export const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'

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
    if (on) boxes.push({ x, y, w })
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
