import { describe, expect, it } from 'vitest'
import {
  addChild,
  addSibling,
  colorOf,
  depth,
  descendants,
  flipSide,
  newMap,
  parseMap,
  removeNode,
  rename,
  reorder,
  resetLayout,
  sampleMap,
  selectionAfterRemove,
  setCollapsed,
  setColor,
  setOffset,
  sideOf,
  siblings,
  toggleCollapsed,
  visibleAncestor,
  type MindMap,
} from './map'

/** root → a (b, c), d */
function small(): MindMap {
  let m = newMap('Root')
  m = addChild(m, 'root', 'a', 'A')
  m = addChild(m, 'a', 'b', 'B')
  m = addChild(m, 'a', 'c', 'C')
  m = addChild(m, 'root', 'd', 'D')
  return m
}

describe('map', () => {
  it('starts with just the central idea', () => {
    const m = newMap('Plan')
    expect(m.nodes[m.root]).toEqual({ id: 'root', text: 'Plan', parent: null, children: [] })
  })

  it('adds children and siblings in order', () => {
    let m = small()
    m = addSibling(m, 'b', 'b2', 'B2')
    expect(m.nodes.a.children).toEqual(['b', 'b2', 'c'])
    expect(m.nodes.b2.parent).toBe('a')
    expect(depth(m, 'b2')).toBe(2)
    // The root has no siblings: "add sibling" adds a child.
    m = addSibling(m, 'root', 'e')
    expect(m.nodes.root.children).toEqual(['a', 'd', 'e'])
  })

  it('balances top-level branches between the sides and gives each its own colour', () => {
    const m = small()
    expect(sideOf(m, 'a')).toBe('right')
    expect(sideOf(m, 'd')).toBe('left')
    expect(sideOf(m, 'c')).toBe('right')
    expect(sideOf(m, 'root')).toBeNull()
    expect([m.nodes.a.color, m.nodes.d.color]).toEqual([0, 1])
    // d (1 node) is lighter than a (3 nodes), so the next branch goes left too.
    expect(sideOf(addChild(m, 'root', 'e'), 'e')).toBe('left')
  })

  it('reuses the least-used colour', () => {
    let m = small()
    m = addChild(m, 'root', 'e')
    m = removeNode(m, 'd')
    expect(addChild(m, 'root', 'f').nodes.f.color).toBe(1)
  })

  it('a sibling of a top-level branch stays on its side', () => {
    const m = addSibling(small(), 'd', 'd2')
    expect(sideOf(m, 'd2')).toBe('left')
    expect(m.nodes.root.children).toEqual(['a', 'd', 'd2'])
  })

  it('inherits colours down a branch unless a node has its own', () => {
    let m = small()
    expect(colorOf(m, 'b')).toBe(0)
    expect(colorOf(m, 'root')).toBeUndefined()
    m = setColor(m, 'b', 5)
    expect(colorOf(m, 'b')).toBe(5)
    expect(colorOf(setColor(m, 'b', undefined), 'b')).toBe(0)
    // Top-level branches always keep a colour, and the root has none.
    expect(setColor(m, 'a', undefined)).toBe(m)
    expect(setColor(m, 'root', 3)).toBe(m)
  })

  it('removes a node with its whole branch and picks the next selection', () => {
    const m = small()
    expect(selectionAfterRemove(m, 'b')).toBe('c')
    expect(selectionAfterRemove(m, 'c')).toBe('b')
    expect(selectionAfterRemove(m, 'd')).toBe('root')
    const out = removeNode(m, 'a')
    expect(Object.keys(out.nodes).sort()).toEqual(['d', 'root'])
    expect(out.nodes.root.children).toEqual(['d'])
    expect(removeNode(m, 'root')).toBe(m)
  })

  it('folds branches, and keeps the root and leaves open', () => {
    let m = small()
    m = toggleCollapsed(m, 'a')
    expect(m.nodes.a.collapsed).toBe(true)
    expect(visibleAncestor(m, 'b')).toBe('a')
    expect(visibleAncestor(m, 'gone')).toBe('root')
    expect(setCollapsed(m, 'b', true)).toBe(m)
    expect(setCollapsed(m, 'root', true)).toBe(m)
    // Adding a child opens a folded parent.
    expect(addChild(m, 'a', 'x').nodes.a.collapsed).toBeUndefined()
  })

  it('renames, and ignores a rename to the same text', () => {
    const m = small()
    expect(rename(m, 'b', 'Bee').nodes.b.text).toBe('Bee')
    expect(rename(m, 'b', 'B')).toBe(m)
  })

  it('reorders among the siblings on the same side', () => {
    let m = addChild(small(), 'root', 'e') // left, after d
    expect(siblings(m, 'e')).toEqual(['d', 'e'])
    m = reorder(m, 'e', -1)
    expect(m.nodes.root.children).toEqual(['a', 'e', 'd'])
    expect(reorder(m, 'e', -1)).toBe(m)
    expect(reorder(small(), 'c', -1).nodes.a.children).toEqual(['c', 'b'])
  })

  it('flips a top-level branch to the other side', () => {
    const m = flipSide(setOffset(small(), 'a', 10, 5), 'a')
    expect(sideOf(m, 'a')).toBe('left')
    expect(sideOf(m, 'b')).toBe('left')
    expect(m.nodes.a.dx).toBeUndefined()
    expect(flipSide(m, 'b')).toBe(m)
  })

  it('stores manual offsets and resets them', () => {
    const m = setOffset(small(), 'b', 12.4, -7.6)
    expect([m.nodes.b.dx, m.nodes.b.dy]).toEqual([12, -8])
    expect(resetLayout(m).nodes.b).toEqual({ id: 'b', text: 'B', parent: 'a', children: [] })
  })

  it('lists descendants depth first', () => {
    expect(descendants(small(), 'root')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('opens with a balanced sample', () => {
    const m = sampleMap()
    expect(m.nodes.root.text).toBe('Learn React')
    expect(m.nodes.root.children.map((c) => sideOf(m, c))).toEqual(['right', 'left', 'right', 'left'])
    expect(parseMap(JSON.parse(JSON.stringify(m)))).toEqual(m)
  })
})

describe('parseMap', () => {
  it('round-trips a map, bare or wrapped in an export', () => {
    const m = setOffset(setColor(toggleCollapsed(small(), 'a'), 'b', 3), 'c', 4, 5)
    const json = JSON.parse(JSON.stringify(m))
    expect(parseMap(json)).toEqual(m)
    expect(parseMap({ app: 'mind-map', version: 1, map: json })).toEqual(m)
  })

  it('rejects things that are not one tree', () => {
    const json = () => JSON.parse(JSON.stringify(small()))
    expect(parseMap(null)).toBeNull()
    expect(parseMap('map')).toBeNull()
    expect(parseMap({ root: 'x', nodes: {} })).toBeNull()

    const badText = json()
    badText.nodes.b.text = 5
    expect(parseMap(badText)).toBeNull()

    const orphan = json()
    orphan.nodes.z = { text: 'Z', parent: 'root', children: [] }
    expect(parseMap(orphan)).toBeNull()

    const wrongParent = json()
    wrongParent.nodes.b.parent = 'd'
    expect(parseMap(wrongParent)).toBeNull()

    const cycle = json()
    cycle.nodes.b.children = ['a']
    cycle.nodes.a.parent = 'b'
    expect(parseMap(cycle)).toBeNull()

    const missingChild = json()
    missingChild.nodes.a.children.push('nope')
    expect(parseMap(missingChild)).toBeNull()
  })

  it('drops invalid optional fields', () => {
    const json = JSON.parse(JSON.stringify(small()))
    Object.assign(json.nodes.b, { color: 99, collapsed: 'yes', dx: 'far', side: 'up' })
    json.nodes.a.color = -1
    const m = parseMap(json)!
    expect(m.nodes.b).toEqual({ id: 'b', text: 'B', parent: 'a', children: [] })
    // A top-level branch always gets a colour.
    expect(m.nodes.a.color).toBe(0)
  })
})
