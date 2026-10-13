import type { Box } from './layout'
import { siblings, type MindMap } from './map'

export type Arrow = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

/** Where an arrow key takes the selection, and a folded branch to open on the way (if any). */
export type Move = { to: string; expand?: string }

/** The child nearest to the node's own height, so stepping outward goes "straight across". */
function middleChild(kids: string[], from: Box, boxes: Record<string, Box>) {
  let best = kids[0]
  for (const k of kids) {
    if (boxes[k] && boxes[best] && Math.abs(boxes[k].y - from.y) < Math.abs(boxes[best].y - from.y)) best = k
  }
  return best
}

/** The closest visible node above (-1) or below (+1), preferring ones in line with this node. */
function nearestVertically(id: string, step: -1 | 1, boxes: Record<string, Box>): string | null {
  const from = boxes[id]
  let best: string | null = null
  let bestScore = Infinity
  for (const b of Object.values(boxes)) {
    const dy = (b.y - from.y) * step
    if (b.id === id || dy <= 0) continue
    const score = dy + 2 * Math.abs(b.x - from.x)
    if (score < bestScore) {
      best = b.id
      bestScore = score
    }
  }
  return best
}

/**
 * Arrow keys walk the tree as it is drawn: away from the centre goes to a child (opening a folded branch),
 * towards it goes to the parent, and up/down go to the neighbouring sibling, or failing that the nearest
 * node in that direction.
 */
export function navigate(map: MindMap, boxes: Record<string, Box>, id: string, key: Arrow): Move {
  const node = map.nodes[id]
  const box = boxes[id]
  if (!box) return { to: map.root }

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const step = key === 'ArrowUp' ? -1 : 1
    const sibs = siblings(map, id)
    const next = node.parent ? sibs[sibs.indexOf(id) + step] : undefined
    return { to: next ?? nearestVertically(id, step, boxes) ?? id }
  }

  const dir = key === 'ArrowRight' ? 1 : -1
  if (box.dir === 0) {
    const kids = node.children.filter((c) => boxes[c]?.dir === dir)
    return { to: kids.length ? middleChild(kids, box, boxes) : id }
  }
  if (dir !== box.dir) return { to: node.parent! }
  if (!node.children.length) return { to: id }
  if (node.collapsed) return { to: node.children[0], expand: id }
  return { to: middleChild(node.children, box, boxes) }
}
