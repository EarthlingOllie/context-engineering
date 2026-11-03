// The UML tab's default view (v3 readability fix). Pure; the page inlines frameView's source, so the body uses
// nothing outside itself.
// Mermaid draws at natural size; the view zooms to frame the step's changes, never below a zoom that keeps names
// readable, and scrolls the diagram box to them.
export interface FrameBox { x: number; y: number; w: number; h: number }
export interface FrameSize { w: number; h: number }
export interface FrameOptions { minZoom: number; maxZoom: number; pad: number }
export interface FrameView { zoom: number; left: number; top: number; /** how many of the boxes the view frames */ framed: number; /** their indices, ascending */ which: number[] }

/**
 * boxes: what to frame, in natural-size coordinates, most important first. All of them when they fit at minZoom,
 * else the first plus the nearest others that still fit, at minZoom (the most context). No boxes fits the whole diagram (never enlarged).
 * Offsets stay inside the content.
 */
export function frameView(boxes: FrameBox[], content: FrameSize, view: FrameSize, o: FrameOptions): FrameView {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const iw = Math.max(1, view.w - 2 * o.pad), ih = Math.max(1, view.h - 2 * o.pad)
  if (!boxes.length) {
    const zoom = clamp(Math.min(iw / content.w, ih / content.h), o.minZoom, Math.max(o.minZoom, Math.min(1, o.maxZoom)))
    return { zoom, left: 0, top: 0, framed: 0, which: [] }
  }
  const union = (a: FrameBox, b: FrameBox): FrameBox => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
  }
  const fits = (b: FrameBox) => b.w * o.minZoom <= iw && b.h * o.minZoom <= ih
  const first = boxes[0]!
  const cx = first.x + first.w / 2, cy = first.y + first.h / 2
  const dist = (b: FrameBox) => Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy)
  const rest = boxes.map((b, i) => i).slice(1).sort((a, b) => dist(boxes[a]!) - dist(boxes[b]!))
  let box = first, framed = 1
  const which = [0]
  for (const i of rest) {
    const u = union(box, boxes[i]!)
    if (fits(u)) { box = u; framed++; which.push(i) }
  }
  which.sort((a, b) => a - b)
  const zoom = framed < boxes.length ? o.minZoom : clamp(Math.min(iw / Math.max(1, box.w), ih / Math.max(1, box.h)), o.minZoom, o.maxZoom)
  const at = (start: number, size: number, viewSize: number) =>
    size * zoom > viewSize ? start * zoom - o.pad : (start + size / 2) * zoom - viewSize / 2
  const left = clamp(at(box.x, box.w, view.w), 0, Math.max(0, content.w * zoom - view.w))
  const top = clamp(at(box.y, box.h, view.h), 0, Math.max(0, content.h * zoom - view.h))
  return { zoom, left, top, framed, which }
}

export interface OffMark { index: number; side: 'left' | 'right' | 'top' | 'bottom'; /** px along that edge, in view coordinates, clamped to it */ at: number }
/**
 * The boxes (natural-size coordinates) that do not meet the view scrolled to `scroll` at `zoom`, each with the edge of the
 * view nearest the way to it: left/right when it lies beyond them, else top/bottom. Pure; the page inlines its source.
 */
export function offView(boxes: FrameBox[], zoom: number, scroll: { left: number; top: number }, view: FrameSize): OffMark[] {
  const out: OffMark[] = []
  boxes.forEach((b, index) => {
    const x0 = b.x * zoom - scroll.left, x1 = (b.x + b.w) * zoom - scroll.left
    const y0 = b.y * zoom - scroll.top, y1 = (b.y + b.h) * zoom - scroll.top
    const midX = Math.max(0, Math.min(view.w, (x0 + x1) / 2)), midY = Math.max(0, Math.min(view.h, (y0 + y1) / 2))
    if (x1 <= 0) out.push({ index, side: 'left', at: midY })
    else if (x0 >= view.w) out.push({ index, side: 'right', at: midY })
    else if (y1 <= 0) out.push({ index, side: 'top', at: midX })
    else if (y0 >= view.h) out.push({ index, side: 'bottom', at: midX })
  })
  return out
}
