import { useEffect, useState } from 'react'
import { estimate, LEVELS, type Measure } from './layout'

/** Real text widths from a canvas, cached; the estimate where canvas isn't available. */
function canvasMeasure(): Measure {
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = document.createElement('canvas').getContext('2d')
  } catch {
    // No canvas (tests, very old browsers).
  }
  if (!ctx) return estimate
  const cache = new Map<string, number>()
  return (text, font) => {
    const key = `${font}|${text}`
    let w = cache.get(key)
    if (w === undefined) {
      ctx.font = font
      w = ctx.measureText(text).width
      cache.set(key, w)
    }
    return w
  }
}

/** A text measurer that is replaced once the web font has loaded, so the layout re-measures with it. */
export function useMeasure(): Measure {
  const [measure, setMeasure] = useState(canvasMeasure)
  useEffect(() => {
    const fonts = document.fonts
    if (!fonts) return
    let live = true
    // A fresh measurer (and cache) once the font is in, dropping widths taken with the fallback font.
    Promise.all(LEVELS.map((l) => fonts.load(l.font))).then(
      () => live && setMeasure(() => canvasMeasure()),
      () => {},
    )
    return () => {
      live = false
    }
  }, [])
  return measure
}
