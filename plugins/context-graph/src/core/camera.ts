// camera: View + target -> screen projector, through vendored three.js math (design.md 4.4).
import { Matrix4, Vector3 } from '../../vendor/three-math/index.js'
import type { Vec3, View } from './types.ts'

export interface Projected {
  x: number
  y: number
  /** distance from the camera along its view axis (positive in front) */
  depth: number
  /** screen pixels per world unit at this depth */
  scale: number
  visible: boolean
}

export const NEAR = 0.5
export const FAR = 5000
const DEG = Math.PI / 180

/** Eye position: target + spherical(yaw, pitch, distance); yaw/pitch in degrees, yaw 0 looks down -z. */
export function eyePosition(view: View, target: Vec3): Vec3 {
  const yaw = view.yaw * DEG
  const pitch = Math.max(-89, Math.min(89, view.pitch)) * DEG
  const c = Math.cos(pitch)
  return {
    x: target.x + view.distance * c * Math.sin(yaw),
    y: target.y + view.distance * Math.sin(pitch),
    z: target.z + view.distance * c * Math.cos(yaw),
  }
}

export function makeProjector(view: View, target: Vec3, size: { w: number; h: number }): (p: Vec3) => Projected {
  const e = eyePosition(view, target)
  const eye = new Vector3(e.x, e.y, e.z)
  const tgt = new Vector3(target.x, target.y, target.z)
  // Camera world matrix (rotation from lookAt + translation to eye); view matrix is its inverse.
  const world = new Matrix4().lookAt(eye, tgt, new Vector3(0, 1, 0)).setPosition(eye)
  const viewM = world.clone().invert()
  const tanHalf = Math.tan((view.fov * DEG) / 2)
  const aspect = size.w / Math.max(1, size.h)
  const top = NEAR * tanHalf
  const right = top * aspect
  const projM = new Matrix4().makePerspective(-right, right, top, -top, NEAR, FAR)
  const v = new Vector3()
  const pxPerUnitAtDepth1 = size.h / 2 / tanHalf

  return (p: Vec3): Projected => {
    v.set(p.x, p.y, p.z).applyMatrix4(viewM)
    const depth = -v.z
    if (!(depth > NEAR && depth < FAR)) return { x: 0, y: 0, depth, scale: 0, visible: false }
    v.applyMatrix4(projM)
    return {
      x: ((v.x + 1) / 2) * size.w,
      y: ((1 - v.y) / 2) * size.h,
      depth,
      scale: pxPerUnitAtDepth1 / depth,
      visible: true,
    }
  }
}
