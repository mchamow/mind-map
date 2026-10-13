import { describe, expect, it } from 'vitest'
import { historyReducer, initHistory, LIMIT, type History, type HistoryAction } from './history'

const run = (actions: HistoryAction<number>[], start = initHistory(0)) =>
  actions.reduce<History<number>>((s, a) => historyReducer(s, a), start)

describe('historyReducer', () => {
  it('records each set as an undo step', () => {
    const s = run([
      { type: 'set', value: 1 },
      { type: 'set', value: 2 },
    ])
    expect(s.present).toBe(2)
    expect(s.past).toEqual([0, 1])
  })

  it('accepts an updater', () => {
    expect(run([{ type: 'set', value: (n) => n + 5 }]).present).toBe(5)
  })

  it('ignores sets that change nothing', () => {
    const start = initHistory(3)
    expect(historyReducer(start, { type: 'set', value: 3 })).toBe(start)
  })

  it('merges a run of sets from the same group until a commit', () => {
    const s = run([
      { type: 'set', value: 1, group: 'brightness' },
      { type: 'set', value: 2, group: 'brightness' },
      { type: 'set', value: 3, group: 'brightness' },
    ])
    expect(s.past).toEqual([0])
    const after = run([{ type: 'commit' }, { type: 'set', value: 4, group: 'brightness' }], s)
    expect(after.past).toEqual([0, 3])
  })

  it('starts a new step when the group changes', () => {
    const s = run([
      { type: 'set', value: 1, group: 'a' },
      { type: 'set', value: 2, group: 'b' },
      { type: 'set', value: 3 },
      { type: 'set', value: 4 },
    ])
    expect(s.past).toEqual([0, 1, 2, 3])
  })

  it('undoes and redoes, and a new change drops the redo stack', () => {
    let s = run([{ type: 'set', value: 1 }, { type: 'set', value: 2 }, { type: 'undo' }, { type: 'undo' }])
    expect(s.present).toBe(0)
    expect(s.future).toEqual([1, 2])
    s = run([{ type: 'redo' }], s)
    expect(s.present).toBe(1)
    s = run([{ type: 'set', value: 9 }], s)
    expect(s.future).toEqual([])
    expect(s.past).toEqual([0, 1])
  })

  it('does nothing when there is nothing to undo or redo', () => {
    const start = initHistory(0)
    expect(historyReducer(start, { type: 'undo' })).toBe(start)
    expect(historyReducer(start, { type: 'redo' })).toBe(start)
  })

  it('a grouped run after an undo is still one step', () => {
    const s = run([
      { type: 'set', value: 1, group: 'a' },
      { type: 'undo' },
      { type: 'set', value: 5, group: 'a' },
      { type: 'set', value: 6, group: 'a' },
    ])
    expect(s.past).toEqual([0])
    expect(s.present).toBe(6)
  })

  it(`keeps the last ${LIMIT} steps`, () => {
    let s = initHistory(0)
    for (let i = 1; i <= LIMIT + 20; i++) s = historyReducer(s, { type: 'set', value: i })
    expect(s.past).toHaveLength(LIMIT)
    expect(s.past[0]).toBe(20)
  })

  it('reset forgets everything', () => {
    const s = run([{ type: 'set', value: 1 }, { type: 'undo' }, { type: 'reset', value: (n) => n + 100 }])
    expect(s).toEqual(initHistory(100))
  })

  it('drop returns to the last step without making the dropped value redoable', () => {
    const s = run([{ type: 'set', value: 1 }, { type: 'set', value: 2 }, { type: 'undo' }, { type: 'set', value: 9 }, { type: 'drop' }])
    expect(s.present).toBe(1)
    expect(s.past).toEqual([0])
    expect(s.future).toEqual([])
    expect(historyReducer(initHistory(0), { type: 'drop' })).toEqual(initHistory(0))
  })
})
