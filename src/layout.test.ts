import { describe, expect, it } from 'vitest'
import { edgePath, estimate, layout, LEVELS, wrap } from './layout'
import { addChild, newMap, setOffset, toggleCollapsed, type MindMap } from './map'

/** One character = 10px. */
const mono = (s: string) => s.length * 10

function small(): MindMap {
  let m = newMap('Root')
  m = addChild(m, 'root', 'a', 'A')
  m = addChild(m, 'a', 'b', 'B')
  m = addChild(m, 'a', 'c', 'C')
  m = addChild(m, 'root', 'd', 'D')
  return m
}

describe('wrap', () => {
  it('keeps short text on one line', () => {
    expect(wrap('hello world', 200, mono)).toEqual(['hello world'])
  })

  it('breaks between words', () => {
    expect(wrap('one two three four', 90, mono)).toEqual(['one two', 'three', 'four'])
  })

  it('honours newlines and keeps empty lines', () => {
    expect(wrap('a\n\nb', 100, mono)).toEqual(['a', '', 'b'])
    expect(wrap('', 100, mono)).toEqual([''])
  })

  it('breaks words longer than a line', () => {
    expect(wrap('abcdefghijkl', 50, mono)).toEqual(['abcde', 'fghij', 'kl'])
  })
})

describe('layout', () => {
  it('centres the central idea and puts branches on their sides', () => {
    const { boxes, order } = layout(small())
    expect(boxes.root).toMatchObject({ x: 0, y: 0, dir: 0, depth: 0 })
    expect(boxes.a.dir).toBe(1)
    expect(boxes.a.x).toBeGreaterThan(boxes.root.x + boxes.root.w / 2)
    expect(boxes.d.dir).toBe(-1)
    expect(boxes.d.x).toBeLessThan(boxes.root.x - boxes.root.w / 2)
    expect(boxes.b.x).toBeGreaterThan(boxes.a.x)
    expect(order).toEqual(['root', 'a', 'b', 'c', 'd'])
  })

  it('stacks children around their parent without overlap', () => {
    const { boxes } = layout(small())
    expect(boxes.b.y).toBeLessThan(boxes.c.y)
    expect(boxes.b.y + boxes.b.h / 2).toBeLessThanOrEqual(boxes.c.y - boxes.c.h / 2)
    expect((boxes.b.y + boxes.c.y) / 2).toBeCloseTo(boxes.a.y)
  })

  it('makes room for a bigger branch next to a smaller one', () => {
    let m = small()
    for (const id of ['x1', 'x2', 'x3', 'x4']) m = addChild(m, 'b', id, id)
    m = addChild(m, 'a', 'e', 'E')
    const { boxes } = layout(m)
    // b's four children are taller than b, so c starts below the last of them.
    expect(boxes.c.y - boxes.c.h / 2).toBeGreaterThanOrEqual(boxes.x4.y + boxes.x4.h / 2)
  })

  it('sizes nodes from their wrapped text and depth', () => {
    const m = addChild(small(), 'b', 'long', 'a fairly long piece of text that has to wrap onto more lines')
    const { boxes } = layout(m, estimate)
    expect(boxes.long.lines.length).toBeGreaterThan(1)
    expect(boxes.long.h).toBe(boxes.long.lines.length * LEVELS[2].lineHeight + 2 * LEVELS[2].padY)
    expect(boxes.root.h).toBe(LEVELS[0].lineHeight + 2 * LEVELS[0].padY)
  })

  it('lays out a node being edited with its draft text', () => {
    const plain = layout(small()).boxes.b.w
    const edited = layout(small(), estimate, (id) => (id === 'b' ? 'Much longer' : undefined)).boxes.b
    expect(edited.lines).toEqual(['Much longer'])
    expect(edited.w).toBeGreaterThan(plain)
  })

  it('hides folded branches and counts what they hide', () => {
    const { boxes, order, edges } = layout(toggleCollapsed(small(), 'a'))
    expect(order).toEqual(['root', 'a', 'd'])
    expect(boxes.a.hidden).toBe(2)
    expect(boxes.a.hasChildren).toBe(true)
    expect(edges.map((e) => e.id)).toEqual(['a', 'd'])
  })

  it('moves a nudged node together with its branch', () => {
    const before = layout(small()).boxes
    const after = layout(setOffset(small(), 'a', 30, -20)).boxes
    for (const id of ['a', 'b', 'c']) {
      expect(after[id].x - before[id].x).toBe(30)
      expect(after[id].y - before[id].y).toBe(-20)
    }
    expect(after.d).toEqual(before.d)
  })

  it('gives edges their branch colour and bounds that contain every node', () => {
    const { edges, bounds, boxes } = layout(small())
    expect(edges.find((e) => e.id === 'b')?.color).toBe(0)
    expect(edges.find((e) => e.id === 'd')?.color).toBe(1)
    for (const b of Object.values(boxes)) {
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(bounds.minX)
      expect(b.x + b.w / 2).toBeLessThanOrEqual(bounds.maxX)
    }
  })

  it('draws edges from the parent edge to the child edge', () => {
    const { boxes } = layout(small())
    const d = edgePath(boxes.a, boxes.b)
    expect(d.startsWith(`M${boxes.a.x + boxes.a.w / 2},${boxes.a.y}`)).toBe(true)
    expect(d.endsWith(`${boxes.b.x - boxes.b.w / 2},${boxes.b.y}`)).toBe(true)
  })
})
