import { beforeEach, describe, expect, it } from 'vitest'
import { addChild, newMap, sampleMap } from './map'
import { loadMap, saveMap, STORAGE_KEY } from './storage'

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('opens the sample when nothing is saved', () => {
    expect(loadMap()).toEqual(sampleMap())
  })

  it('round-trips a saved map', () => {
    const m = addChild(newMap('Mine'), 'root', 'x', 'X')
    saveMap(m)
    expect(loadMap()).toEqual(m)
  })

  it('falls back to the sample on corrupt or invalid data', () => {
    localStorage.setItem(STORAGE_KEY, '{nope')
    expect(loadMap()).toEqual(sampleMap())
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ root: 'root', nodes: { root: { text: 1 } } }))
    expect(loadMap()).toEqual(sampleMap())
  })
})
