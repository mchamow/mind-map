/** The mind map as plain data: a tree of nodes keyed by id. Every function here returns a new map. */

export type Side = 'left' | 'right'

export type MindNode = {
  id: string
  text: string
  parent: string | null
  children: string[]
  /** Which side of the central idea a top-level branch grows on. */
  side?: Side
  /** Index into the branch palette; descendants without their own colour inherit it. */
  color?: number
  collapsed?: boolean
  /** A manual nudge away from the automatic position, in map units. It carries the node's branch along. */
  dx?: number
  dy?: number
}

export type MindMap = { root: string; nodes: Record<string, MindNode> }

export const COLOR_NAMES = ['Red', 'Orange', 'Amber', 'Green', 'Teal', 'Blue', 'Violet', 'Pink'] as const
export const COLORS = COLOR_NAMES.length

const ROOT = 'root'

export function newMap(text = 'Central idea'): MindMap {
  return { root: ROOT, nodes: { [ROOT]: { id: ROOT, text, parent: null, children: [] } } }
}

const patch = (map: MindMap, id: string, changes: Partial<MindNode>): MindMap => ({
  ...map,
  nodes: { ...map.nodes, [id]: { ...map.nodes[id], ...changes } },
})

export function depth(map: MindMap, id: string): number {
  let d = 0
  for (let n = map.nodes[id]; n?.parent; n = map.nodes[n.parent]) d++
  return d
}

/** The node's ancestors, nearest first. */
export function ancestors(map: MindMap, id: string): string[] {
  const out: string[] = []
  for (let p = map.nodes[id]?.parent; p; p = map.nodes[p].parent) out.push(p)
  return out
}

/** The top-level branch a node belongs to (itself, for a top-level node); null for the root. */
function branchOf(map: MindMap, id: string): MindNode | null {
  let n = map.nodes[id]
  if (!n?.parent) return null
  while (n.parent !== map.root) n = map.nodes[n.parent!]
  return n
}

export const sideOf = (map: MindMap, id: string): Side | null => {
  const branch = branchOf(map, id)
  return branch ? (branch.side ?? 'right') : null
}

/** The node's own colour or the nearest ancestor's; undefined for the root. */
export function colorOf(map: MindMap, id: string): number | undefined {
  for (let n: MindNode | undefined = map.nodes[id]; n; n = n.parent ? map.nodes[n.parent] : undefined) {
    if (n.color !== undefined) return n.color
  }
  return undefined
}

/** Every node below this one, depth first. */
export function descendants(map: MindMap, id: string): string[] {
  const out: string[] = []
  const walk = (n: string) => {
    for (const c of map.nodes[n].children) {
      out.push(c)
      walk(c)
    }
  }
  walk(id)
  return out
}

/** The node itself, or the collapsed ancestor that hides it. */
export function visibleAncestor(map: MindMap, id: string): string {
  if (!map.nodes[id]) return map.root
  let shown = id
  for (const a of ancestors(map, id)) if (map.nodes[a].collapsed) shown = a
  return shown
}

/** Siblings as the user sees them: top-level branches only count those on the same side. */
export function siblings(map: MindMap, id: string): string[] {
  const n = map.nodes[id]
  if (!n.parent) return [id]
  const all = map.nodes[n.parent].children
  if (n.parent !== map.root) return all
  const side = sideOf(map, id)
  return all.filter((c) => sideOf(map, c) === side)
}

function weight(map: MindMap, id: string) {
  return 1 + descendants(map, id).length
}

/** The palette colour used least among the top-level branches (lowest index on ties). */
function nextColor(map: MindMap): number {
  const used = new Array<number>(COLORS).fill(0)
  for (const c of map.nodes[map.root].children) {
    const color = map.nodes[c].color
    if (color !== undefined) used[color]++
  }
  return used.indexOf(Math.min(...used))
}

function insert(map: MindMap, parentId: string, node: MindNode, index?: number): MindMap {
  // Adding to a folded branch opens it, so the new node is visible.
  const { collapsed: _collapsed, ...parent } = map.nodes[parentId]
  const children = [...parent.children]
  children.splice(index ?? children.length, 0, node.id)
  return { ...map, nodes: { ...map.nodes, [node.id]: node, [parentId]: { ...parent, children } } }
}

export function addChild(map: MindMap, parentId: string, id: string, text = ''): MindMap {
  const node: MindNode = { id, text, parent: parentId, children: [] }
  if (parentId === map.root) {
    // New top-level branches go to the lighter side, with the least-used colour.
    let left = 0
    let right = 0
    for (const c of map.nodes[map.root].children) {
      if (sideOf(map, c) === 'left') left += weight(map, c)
      else right += weight(map, c)
    }
    node.side = right <= left ? 'right' : 'left'
    node.color = nextColor(map)
  }
  return insert(map, parentId, node)
}

/** Adds a node right after this one under the same parent (a child, for the root). */
export function addSibling(map: MindMap, id: string, newId: string, text = ''): MindMap {
  const n = map.nodes[id]
  if (!n.parent) return addChild(map, id, newId, text)
  const node: MindNode = { id: newId, text, parent: n.parent, children: [] }
  if (n.parent === map.root) {
    node.side = sideOf(map, id)!
    node.color = nextColor(map)
  }
  const index = map.nodes[n.parent].children.indexOf(id) + 1
  return insert(map, n.parent, node, index)
}

/** Deletes a node with its whole branch. The root stays. */
export function removeNode(map: MindMap, id: string): MindMap {
  const n = map.nodes[id]
  if (!n?.parent) return map
  const nodes = { ...map.nodes }
  for (const d of [id, ...descendants(map, id)]) delete nodes[d]
  const parent = nodes[n.parent]
  nodes[n.parent] = { ...parent, children: parent.children.filter((c) => c !== id) }
  return { ...map, nodes }
}

/** Where the selection goes when this node is deleted: the next sibling, else the previous, else the parent. */
export function selectionAfterRemove(map: MindMap, id: string): string {
  const n = map.nodes[id]
  if (!n.parent) return id
  const sibs = siblings(map, id)
  const i = sibs.indexOf(id)
  return sibs[i + 1] ?? sibs[i - 1] ?? n.parent
}

export const rename = (map: MindMap, id: string, text: string): MindMap =>
  map.nodes[id].text === text ? map : patch(map, id, { text })

/** Folds or unfolds a branch. The root and leaves can't fold. */
export function setCollapsed(map: MindMap, id: string, collapsed: boolean): MindMap {
  const n = map.nodes[id]
  if (!n.parent || n.children.length === 0 || !!n.collapsed === collapsed) return map
  return patch(map, id, { collapsed })
}

export const toggleCollapsed = (map: MindMap, id: string) => setCollapsed(map, id, !map.nodes[id].collapsed)

/** Sets (or, with undefined, clears) a node's colour. Top-level branches always keep one. */
export function setColor(map: MindMap, id: string, color: number | undefined): MindMap {
  const n = map.nodes[id]
  if (!n.parent) return map
  if (color === undefined && n.parent === map.root) return map
  return patch(map, id, { color })
}

export function setOffset(map: MindMap, id: string, dx: number, dy: number): MindMap {
  return patch(map, id, { dx: Math.round(dx), dy: Math.round(dy) })
}

/** Forgets every manual nudge, back to the automatic layout. */
export function resetLayout(map: MindMap): MindMap {
  const nodes: Record<string, MindNode> = {}
  for (const [id, n] of Object.entries(map.nodes)) {
    const { dx: _dx, dy: _dy, ...rest } = n
    nodes[id] = rest
  }
  return { ...map, nodes }
}

/** Moves a node one place up (-1) or down (+1) among the siblings beside it. */
export function reorder(map: MindMap, id: string, delta: -1 | 1): MindMap {
  const n = map.nodes[id]
  if (!n.parent) return map
  const sibs = siblings(map, id)
  const other = sibs[sibs.indexOf(id) + delta]
  if (!other) return map
  const children = [...map.nodes[n.parent].children]
  const a = children.indexOf(id)
  const b = children.indexOf(other)
  ;[children[a], children[b]] = [children[b], children[a]]
  return patch(map, n.parent, { children })
}

/** Moves a top-level branch to the other side of the central idea. */
export function flipSide(map: MindMap, id: string): MindMap {
  const n = map.nodes[id]
  if (n.parent !== map.root) return map
  return patch(map, id, { side: sideOf(map, id) === 'left' ? 'right' : 'left', dx: undefined, dy: undefined })
}

/** Checks untrusted data (saved or imported) and returns a map, or null if it isn't a valid one. */
export function parseMap(value: unknown): MindMap | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = 'map' in value && typeof value.map === 'object' ? value.map : value
  if (typeof raw !== 'object' || raw === null) return null
  const { root, nodes } = raw as { root?: unknown; nodes?: unknown }
  if (typeof root !== 'string' || typeof nodes !== 'object' || nodes === null || Array.isArray(nodes)) return null

  const out: Record<string, MindNode> = {}
  for (const [id, v] of Object.entries(nodes as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) return null
    const n = v as Record<string, unknown>
    if (typeof n.text !== 'string') return null
    if (!Array.isArray(n.children) || !n.children.every((c) => typeof c === 'string')) return null
    const node: MindNode = {
      id,
      text: n.text,
      parent: typeof n.parent === 'string' ? n.parent : null,
      children: n.children as string[],
    }
    if (n.side === 'left' || n.side === 'right') node.side = n.side
    if (Number.isInteger(n.color) && (n.color as number) >= 0 && (n.color as number) < COLORS) node.color = n.color as number
    if (n.collapsed === true) node.collapsed = true
    if (typeof n.dx === 'number' && Number.isFinite(n.dx)) node.dx = n.dx
    if (typeof n.dy === 'number' && Number.isFinite(n.dy)) node.dy = n.dy
    out[id] = node
  }

  // One tree: the root has no parent, every child points back at its parent, and every node is reachable once.
  if (!out[root] || out[root].parent !== null) return null
  const seen = new Set<string>()
  const stack = [root]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) return null
    seen.add(id)
    for (const c of out[id].children) {
      if (out[c]?.parent !== id) return null
      stack.push(c)
    }
  }
  if (seen.size !== Object.keys(out).length) return null
  for (const c of out[root].children) out[c].color ??= 0
  return { root, nodes: out }
}

/** The map a first visit opens with. */
export function sampleMap(): MindMap {
  const tree: [string, string[]][] = [
    ['Basics', ['JSX', 'Components', 'Props']],
    ['State', ['useState', 'useReducer', 'Lifting state up']],
    ['Effects', ['useEffect', 'Cleanup']],
    ['Tooling', ['Vite', 'TypeScript', 'Vitest']],
  ]
  let map = newMap('Learn React')
  let n = 0
  for (const [branch, leaves] of tree) {
    const id = `n${++n}`
    map = addChild(map, map.root, id, branch)
    for (const leaf of leaves) map = addChild(map, id, `n${++n}`, leaf)
  }
  return map
}
