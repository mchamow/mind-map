import { describe, expect, it } from 'vitest'
import { centerOn, fit, MAX_ZOOM, MIN_ZOOM, reveal, zoomAt } from './view'

const size = { width: 800, height: 600 }

describe('view', () => {
  it('zooms around a point, keeping it fixed', () => {
    const v = zoomAt({ x: 100, y: 50, k: 1 }, 2, 300, 250)
    // The world point under (300, 250) was (200, 200) and still is.
    expect((300 - v.x) / v.k).toBe(200)
    expect((250 - v.y) / v.k).toBe(200)
    expect(zoomAt(v, 100, 0, 0).k).toBe(MAX_ZOOM)
    expect(zoomAt(v, 0.001, 0, 0).k).toBe(MIN_ZOOM)
  })

  it('fits bounds in the middle, without zooming in past 100%', () => {
    const small = fit({ minX: -50, minY: -20, maxX: 50, maxY: 20 }, size)
    expect(small).toEqual({ x: 400, y: 300, k: 1 })
    const big = fit({ minX: 0, minY: 0, maxX: 1440, maxY: 260 }, size)
    expect(big.k).toBeCloseTo(0.5)
    expect(big.x + 720 * big.k).toBeCloseTo(400)
    const readable = fit({ minX: 0, minY: 0, maxX: 1440, maxY: 260 }, size, { minZoom: 0.6 })
    expect(readable.k).toBe(0.6)
    expect(readable.x + 720 * readable.k).toBeCloseTo(400)
  })

  it('centres on a point', () => {
    expect(centerOn({ x: 0, y: 0, k: 2 }, 10, 20, size)).toEqual({ x: 380, y: 260, k: 2 })
  })

  it('pans only as far as needed to reveal a box', () => {
    const view = { x: 0, y: 0, k: 1 }
    const inside = { x: 400, y: 300, w: 100, h: 40 }
    expect(reveal(view, inside, size)).toBe(view)
    // Off the right edge: its right side lands at width - margin.
    expect(reveal(view, { x: 900, y: 300, w: 100, h: 40 }, size)).toEqual({ x: -182, y: 0, k: 1 })
    // Above the top.
    expect(reveal(view, { x: 400, y: -100, w: 100, h: 40 }, size)).toEqual({ x: 0, y: 152, k: 1 })
  })
})
