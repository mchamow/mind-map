import { parseMap, sampleMap, type MindMap } from './map'

export const STORAGE_KEY = 'mind-map:v1'

/** The saved map, or the sample when nothing (valid) is saved. */
export function loadMap(): MindMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return parseMap(JSON.parse(raw)) ?? sampleMap()
  } catch {
    // Corrupt JSON or storage that can't be read: start from the sample.
  }
  return sampleMap()
}

export function saveMap(map: MindMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works without it.
  }
}
