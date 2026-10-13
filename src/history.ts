/** Undo/redo around a value. `group` marks the slider a run of changes came from. */
export type History<T> = {
  past: T[]
  present: T
  future: T[]
  group: string | null
}

export type HistoryAction<T> =
  /** A new value. Consecutive sets with the same group (one slider drag) become one undo step. */
  | { type: 'set'; value: T | ((present: T) => T); group?: string }
  /** Ends the current group, so the next change starts a new undo step. */
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' }
  /** Throws away the present and returns to the last undo step, leaving nothing to redo (a cancelled change). */
  | { type: 'drop' }
  /** Starts over from a value, forgetting everything (e.g. a new photo). */
  | { type: 'reset'; value: T | ((present: T) => T) }

export const LIMIT = 100

export const initHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], group: null })

const resolve = <T>(value: T | ((present: T) => T), present: T): T =>
  typeof value === 'function' ? (value as (present: T) => T)(present) : value

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function historyReducer<T>(state: History<T>, action: HistoryAction<T>): History<T> {
  switch (action.type) {
    case 'set': {
      const value = resolve(action.value, state.present)
      if (same(value, state.present)) return state
      const group = action.group ?? null
      if (group !== null && group === state.group) return { ...state, present: value, future: [] }
      return { past: [...state.past, state.present].slice(-LIMIT), present: value, future: [], group }
    }
    case 'commit':
      return state.group === null ? state : { ...state, group: null }
    case 'undo': {
      const previous = state.past.at(-1)
      if (previous === undefined) return state
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], group: null }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (next === undefined) return state
      return { past: [...state.past, state.present], present: next, future: rest, group: null }
    }
    case 'drop': {
      const previous = state.past.at(-1)
      if (previous === undefined) return state
      return { past: state.past.slice(0, -1), present: previous, future: state.future, group: null }
    }
    case 'reset':
      return initHistory(resolve(action.value, state.present))
  }
}
