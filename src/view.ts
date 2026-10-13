/** Pan and zoom: a screen point is `world * k + (x, y)`, relative to the canvas's top-left corner. */
export type View = { x: number; y: number; k: number }

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2.5

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type Size = { width: number; height: number }

export const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))

/** Zooms to `k` keeping the world point under the screen point (px, py) where it is. */
export function zoomAt(view: View, k: number, px: number, py: number): View {
  const next = clampZoom(k)
  const wx = (px - view.x) / view.k
  const wy = (py - view.y) / view.k
  return { x: px - wx * next, y: py - wy * next, k: next }
}

/**
 * Fits the bounds into the canvas with some padding, never zooming in past `maxZoom` nor out past
 * `minZoom` (a big map on a small screen then overflows, centred, rather than shrinking past reading size).
 */
export function fit(bounds: Bounds, size: Size, { pad = 40, maxZoom = 1, minZoom = MIN_ZOOM } = {}): View {
  const w = bounds.maxX - bounds.minX
  const h = bounds.maxY - bounds.minY
  const k = clampZoom(Math.max(minZoom, Math.min(maxZoom, (size.width - 2 * pad) / w, (size.height - 2 * pad) / h)))
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return { x: size.width / 2 - cx * k, y: size.height / 2 - cy * k, k }
}

/** Centres a world point on the canvas at the current zoom. */
export const centerOn = (view: View, wx: number, wy: number, size: Size): View => ({
  ...view,
  x: size.width / 2 - wx * view.k,
  y: size.height / 2 - wy * view.k,
})

/** Pans just enough to bring a world rectangle (centre + size) inside the canvas with a margin. */
export function reveal(view: View, box: { x: number; y: number; w: number; h: number }, size: Size, margin = 32): View {
  const left = (box.x - box.w / 2) * view.k + view.x
  const right = (box.x + box.w / 2) * view.k + view.x
  const top = (box.y - box.h / 2) * view.k + view.y
  const bottom = (box.y + box.h / 2) * view.k + view.y
  let dx = 0
  let dy = 0
  if (right - left > size.width - 2 * margin) dx = size.width / 2 - (left + right) / 2
  else if (left < margin) dx = margin - left
  else if (right > size.width - margin) dx = size.width - margin - right
  if (bottom - top > size.height - 2 * margin) dy = size.height / 2 - (top + bottom) / 2
  else if (top < margin) dy = margin - top
  else if (bottom > size.height - margin) dy = size.height - margin - bottom
  return dx || dy ? { ...view, x: view.x + dx, y: view.y + dy } : view
}
