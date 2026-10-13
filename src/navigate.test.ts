import { describe, expect, it } from 'vitest'
import { layout } from './layout'
import { addChild, flipSide, newMap, toggleCollapsed, type MindMap } from './map'
import { navigate, type Arrow } from './navigate'

/** root → right: a (b, c, e); left: d (f) */
function small(): MindMap {
  let m = newMap('Root')
  m = addChild(m, 'root', 'a', 'A')
  m = addChild(m, 'a', 'b', 'B')
  m = addChild(m, 'a', 'c', 'C')
  m = addChild(m, 'a', 'e', 'E')
  m = addChild(m, 'root', 'd', 'D')
  m = addChild(m, 'd', 'f', 'F')
  return m
}

const go = (m: MindMap, id: string, key: Arrow) => navigate(m, layout(m).boxes, id, key)

describe('navigate', () => {
  it('goes from the centre to the branch on that side', () => {
    const m = small()
    expect(go(m, 'root', 'ArrowRight').to).toBe('a')
    expect(go(m, 'root', 'ArrowLeft').to).toBe('d')
    expect(go(newMap(), 'root', 'ArrowRight').to).toBe('root')
  })

  it('goes outwards to the middle child and inwards to the parent', () => {
    const m = small()
    expect(go(m, 'a', 'ArrowRight').to).toBe('c')
    expect(go(m, 'c', 'ArrowLeft').to).toBe('a')
    expect(go(m, 'a', 'ArrowLeft').to).toBe('root')
    // On the left side the directions mirror.
    expect(go(m, 'd', 'ArrowLeft').to).toBe('f')
    expect(go(m, 'd', 'ArrowRight').to).toBe('root')
    expect(go(m, 'b', 'ArrowRight').to).toBe('b')
  })

  it('opens a folded branch when stepping into it', () => {
    const m = toggleCollapsed(small(), 'a')
    expect(go(m, 'a', 'ArrowRight')).toEqual({ to: 'b', expand: 'a' })
  })

  it('moves between siblings, then to the nearest node beyond them', () => {
    const m = small()
    expect(go(m, 'b', 'ArrowDown').to).toBe('c')
    expect(go(m, 'c', 'ArrowUp').to).toBe('b')
    // Nothing below the last child of a, nothing above the first.
    expect(go(m, 'e', 'ArrowDown').to).toBe('e')
    expect(go(m, 'b', 'ArrowUp').to).toBe('b')
    let wide = flipSide(addChild(m, 'root', 'g', 'G'), 'g') // a second right-side branch, below a
    wide = addChild(wide, 'g', 'h', 'H')
    expect(go(wide, 'e', 'ArrowDown').to).toBe('h')
  })

  it('falls back to the root for a node that is not drawn', () => {
    const m = toggleCollapsed(small(), 'a')
    expect(go(m, 'b', 'ArrowUp').to).toBe('root')
  })
})
