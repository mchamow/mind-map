import { useEffect, useReducer } from 'react'
import { historyReducer, initHistory, type HistoryAction } from './history'
import type { MindMap } from './map'
import { loadMap, saveMap } from './storage'

/** The map with undo/redo, saved to localStorage on every change. */
export function useMindMap() {
  const [history, dispatch] = useReducer(historyReducer<MindMap>, undefined, () => initHistory(loadMap()))
  useEffect(() => saveMap(history.present), [history.present])
  return {
    map: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dispatch: dispatch as (action: HistoryAction<MindMap>) => void,
  }
}
