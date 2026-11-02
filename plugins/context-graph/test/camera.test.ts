// Feature 10 (camera half): projection through vendored three.js Matrix4/Vector3.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeProjector, eyePosition } from '../src/core/camera.ts'

const size = { w: 800, h: 600 }
const view = { yaw: 30, pitch: 20, distance: 100, fov: 50 }

test('the target projects to the screen centre', () => {
  const p = makeProjector(view, { x: 0, y: 0, z: 0 }, size)({ x: 0, y: 0, z: 0 })
  assert.ok(Math.abs(p.x - 400) <= 0.5 && Math.abs(p.y - 300) <= 0.5, JSON.stringify(p))
  assert.equal(p.visible, true)
  assert.ok(Math.abs(p.depth - 100) < 1e-6)
})

test('an off-centre target still lands in the centre', () => {
  const t = { x: 40, y: -12, z: 7 }
  const p = makeProjector(view, t, size)(t)
  assert.ok(Math.abs(p.x - 400) <= 0.5 && Math.abs(p.y - 300) <= 0.5)
})

test('a point behind the camera is not visible', () => {
  const eye = eyePosition(view, { x: 0, y: 0, z: 0 })
  const behind = { x: eye.x * 2, y: eye.y * 2, z: eye.z * 2 }
  assert.equal(makeProjector(view, { x: 0, y: 0, z: 0 }, size)(behind).visible, false)
})

test('nearer points get a larger scale', () => {
  const eye = eyePosition(view, { x: 0, y: 0, z: 0 })
  const proj = makeProjector(view, { x: 0, y: 0, z: 0 }, size)
  const near = proj({ x: eye.x * 0.5, y: eye.y * 0.5, z: eye.z * 0.5 })
  const far = proj({ x: -eye.x, y: -eye.y, z: -eye.z })
  assert.ok(near.visible && far.visible)
  assert.ok(near.scale > far.scale)
  assert.ok(near.depth < far.depth)
})

test('screen y grows downward: a point above the target projects above centre', () => {
  const p = makeProjector({ yaw: 0, pitch: 0, distance: 100, fov: 50 }, { x: 0, y: 0, z: 0 }, size)({ x: 0, y: 10, z: 0 })
  assert.ok(p.y < 300)
})
