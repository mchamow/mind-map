import { colorOf, descendants, sideOf, type MindMap } from './map'

/** How nodes look at each depth: the central idea, top-level branches, and everything below. */
export const LEVELS = [
  { font: '600 18px "Geist Variable", sans-serif', size: 18, lineHeight: 26, padX: 20, padY: 12, maxWidth: 240, gapX: 64, gapY: 22 },
  { font: '600 15px "Geist Variable", sans-serif', size: 15, lineHeight: 22, padX: 14, padY: 8, maxWidth: 200, gapX: 40, gapY: 12 },
  { font: '400 14px "Geist Variable", sans-serif', size: 14, lineHeight: 20, padX: 10, padY: 6, maxWidth: 180, gapX: 32, gapY: 8 },
] as const

/** Diameter of the fold button that sits on a branch's outer edge. */
export const FOLD_SIZE = 22

export type Level =(typeof LEVELS)[number]
export const levelOf = (depth: number): Level => LEVELS[Math.min(depth, LEVELS.length - 1)]

/** Width of a line of text in a given CSS font. */
export type Measure = (text: string, font: string, size: number) => number

/** A stand-in for real text metrics (tests, or a browser without canvas). */
export const estimate: Measure = (text, _font, size) => text.length * size * 0.56

/** Splits text into lines no wider than `max`: on newlines, then between words, then inside long words. */
export function wrap(text: string, max: number, width: (s: string) => number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/ +/)) {
      const next = line ? `${line} ${word}` : word
      if (width(next) <= max) {
        line = next
        continue
      }
      if (line) lines.push(line)
      line = ''
      // A word too long for a line on its own is broken wherever it overflows.
      let rest = word
      while (width(rest) > max && rest.length > 1) {
        let cut = rest.length - 1
        while (cut > 1 && width(rest.slice(0, cut)) > max) cut--
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    lines.push(line)
  }
  return lines
}

export type Box = {
  id: string
  /** Centre of the node, in map units. */
  x: number
  y: number
  w: number
  h: number
  lines: string[]
  depth: number
  /** 1 grows to the right, -1 to the left, 0 for the central idea. */
  dir: -1 | 0 | 1
  color: number | undefined
  /** How many nodes a folded branch hides (0 when open). */
  hidden: number
  hasChildren: boolean
}

export type Edge = { id: string; d: string; color: number | undefined; depth: number }

export type Layout = {
  boxes: Record<string, Box>
  /** Visible nodes, parents before children. */
  order: string[]
  edges: Edge[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

/** A smooth curve from a parent's outer edge to a child's inner edge. */
export function edgePath(from: Box, to: Box): string {
  const dir = to.dir || 1
  const x1 = from.dir === 0 ? from.x + (dir * from.w) / 2 - dir * 8 : from.x + (dir * from.w) / 2
  const x2 = to.x - (dir * to.w) / 2
  const mid = (x1 + x2) / 2
  const r = (n: number) => Math.round(n * 10) / 10
  return `M${r(x1)},${r(from.y)} C${r(mid)},${r(from.y)} ${r(mid)},${r(to.y)} ${r(x2)},${r(to.y)}`
}

/**
 * Places every visible node: top-level branches stack on their side of the central idea, and each node's
 * children stack beside it, centred on it, with room for their own branches. Manual nudges move a node and
 * everything under it. `textOf` lets a node being edited lay out with its draft text.
 */
export function layout(map: MindMap, measure: Measure = estimate, textOf?: (id: string) => string | undefined): Layout {
  const sizes = new Map<string, { w: number; h: number; lines: string[]; depth: number }>()
  const size = (id: string, depth: number) => {
    let s = sizes.get(id)
    if (!s) {
      const level = levelOf(depth)
      const text = textOf?.(id) ?? map.nodes[id].text
      const width = (line: string) => measure(line, level.font, level.size)
      const lines = wrap(text, level.maxWidth, width)
      const content = Math.max(24, ...lines.map(width))
      s = { w: Math.ceil(content) + 2 * level.padX + 2, h: lines.length * level.lineHeight + 2 * level.padY, lines, depth }
      sizes.set(id, s)
    }
    return s
  }

  const open = (id: string) => !map.nodes[id].collapsed
  const blocks = new Map<string, number>()
  /** Height of the band a node and its open branches take up. */
  const block = (id: string, depth: number, kids = map.nodes[id].children): number => {
    if (!kids.length || !open(id)) return size(id, depth).h
    const gap = levelOf(depth + 1).gapY
    const total = kids.reduce((sum, c) => sum + blockOf(c, depth + 1), 0) + gap * (kids.length - 1)
    return Math.max(size(id, depth).h, total)
  }
  const blockOf = (id: string, depth: number) => {
    let b = blocks.get(id)
    if (b === undefined) blocks.set(id, (b = block(id, depth)))
    return b
  }

  const boxes: Record<string, Box> = {}
  const order: string[] = []
  const edges: Edge[] = []

  const place = (id: string, x: number, y: number, depth: number, dir: -1 | 0 | 1) => {
    const n = map.nodes[id]
    const s = size(id, depth)
    boxes[id] = {
      id,
      x,
      y,
      w: s.w,
      h: s.h,
      lines: s.lines,
      depth,
      dir,
      color: colorOf(map, id),
      hidden: n.collapsed ? descendants(map, id).length : 0,
      hasChildren: n.children.length > 0,
    }
    order.push(id)
    if (!open(id)) return
    if (dir === 0) {
      stack(id, n.children.filter((c) => sideOf(map, c) === 'right'), 1)
      stack(id, n.children.filter((c) => sideOf(map, c) === 'left'), -1)
    } else stack(id, n.children, dir)
  }

  const stack = (parentId: string, kids: string[], dir: -1 | 1) => {
    if (!kids.length) return
    const parent = boxes[parentId]
    const level = levelOf(parent.depth + 1)
    const heights = kids.map((c) => blockOf(c, parent.depth + 1))
    const total = heights.reduce((a, b) => a + b, 0) + level.gapY * (kids.length - 1)
    let top = parent.y - total / 2
    kids.forEach((c, i) => {
      const n = map.nodes[c]
      const s = size(c, parent.depth + 1)
      const x = parent.x + dir * (parent.w / 2 + levelOf(parent.depth).gapX + s.w / 2) + (n.dx ?? 0)
      const y = top + heights[i] / 2 + (n.dy ?? 0)
      place(c, x, y, parent.depth + 1, dir)
      edges.push({ id: c, d: edgePath(parent, boxes[c]), color: boxes[c].color, depth: parent.depth + 1 })
      top += heights[i] + level.gapY
    })
  }

  const root = map.nodes[map.root]
  place(map.root, root.dx ?? 0, root.dy ?? 0, 0, 0)

  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const b of Object.values(boxes)) {
    // Leave room for the "+N" badge on the outer side of a folded branch.
    const badge = b.hidden ? FOLD_SIZE + 4 : 0
    bounds.minX = Math.min(bounds.minX, b.x - b.w / 2 - (b.dir < 0 ? badge : 0))
    bounds.maxX = Math.max(bounds.maxX, b.x + b.w / 2 + (b.dir > 0 ? badge : 0))
    bounds.minY = Math.min(bounds.minY, b.y - b.h / 2)
    bounds.maxY = Math.max(bounds.maxY, b.y + b.h / 2)
  }
  return { boxes, order, edges, bounds }
}
