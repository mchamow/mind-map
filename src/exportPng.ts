import { FOLD_SIZE, levelOf, type Layout } from './layout'

const PAD = 40
const RADIUS = [18, 14, 10]
const BORDER = [0, 2, 1]

/** Draws the map as it looks now (current theme, folded branches folded) onto a canvas, at 2× for sharpness. */
export function renderPng(layout: Layout, scale = 2): Promise<Blob | null> {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(name).trim()
  const branch = (color: number | undefined) => token(color === undefined ? '--muted-foreground' : `--branch-${color}`)

  const { minX, minY, maxX, maxY } = layout.bounds
  const width = maxX - minX + 2 * PAD
  const height = maxY - minY + 2 * PAD
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  ctx.scale(scale, scale)
  ctx.fillStyle = token('--background')
  ctx.fillRect(0, 0, width, height)
  ctx.translate(PAD - minX, PAD - minY)

  ctx.lineCap = 'round'
  for (const e of layout.edges) {
    ctx.strokeStyle = branch(e.color)
    ctx.lineWidth = e.depth === 1 ? 3 : 2
    ctx.stroke(new Path2D(e.d))
  }

  for (const id of layout.order) {
    const b = layout.boxes[id]
    const level = levelOf(b.depth)
    const d = Math.min(b.depth, 2)
    const left = b.x - b.w / 2
    const top = b.y - b.h / 2
    const shape = () => {
      ctx.beginPath()
      ctx.roundRect(left + BORDER[d] / 2, top + BORDER[d] / 2, b.w - BORDER[d], b.h - BORDER[d], RADIUS[d])
    }

    shape()
    ctx.fillStyle = token(d === 0 ? '--primary' : '--card')
    ctx.fill()
    if (d === 1) {
      // A 14% tint of the branch colour, as on screen.
      ctx.globalAlpha = 0.14
      ctx.fillStyle = branch(b.color)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (d > 0) {
      ctx.lineWidth = BORDER[d]
      ctx.strokeStyle = token('--border')
      if (d === 2) ctx.stroke()
      ctx.globalAlpha = d === 1 ? 1 : 0.45
      ctx.strokeStyle = branch(b.color)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.font = level.font
    ctx.textBaseline = 'middle'
    ctx.textAlign = d === 0 ? 'center' : 'left'
    ctx.fillStyle = token(d === 0 ? '--primary-foreground' : '--foreground')
    b.lines.forEach((line, i) => {
      const y = top + level.padY + level.lineHeight * (i + 0.5)
      ctx.fillText(line, d === 0 ? b.x : left + level.padX, y)
    })

    if (b.hidden) {
      const cx = b.dir > 0 ? b.x + b.w / 2 + 4 + FOLD_SIZE / 2 : b.x - b.w / 2 - 4 - FOLD_SIZE / 2
      ctx.beginPath()
      ctx.arc(cx, b.y, FOLD_SIZE / 2 - 1, 0, Math.PI * 2)
      ctx.fillStyle = token('--background')
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = branch(b.color)
      ctx.stroke()
      ctx.font = '600 11px "Geist Variable", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = branch(b.color)
      ctx.fillText(b.hidden > 99 ? '99+' : String(b.hidden), cx, b.y + 0.5)
    }
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
