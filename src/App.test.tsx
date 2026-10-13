import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_KEY } from './storage'

const tree = () => screen.getByRole('tree', { name: 'Mind map' })
const item = (name: string) => within(tree()).getByRole('treeitem', { name })
const names = () => within(tree()).queryAllByRole('treeitem').map((n) => n.textContent)
const selectedName = () => within(tree()).getByRole('treeitem', { selected: true }).textContent
const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(tree(), { key, ...init })
const editor = () => screen.getByRole('textbox', { name: 'Node text' })
const button = (name: string) => screen.getByRole('button', { name })
const status = () => screen.getByRole('status').textContent

function select(name: string) {
  fireEvent.pointerDown(item(name), { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(item(name), { pointerId: 1, clientX: 0, clientY: 0 })
}

/** Types into the open editor and presses a key in it. */
function type(text: string, key = 'Enter') {
  fireEvent.change(editor(), { target: { value: text } })
  fireEvent.keyDown(editor(), { key })
}

function saved() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!)
}

beforeEach(() => {
  localStorage.clear()
  // jsdom has no layout or canvas: the app falls back to estimated text widths.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('opens with the sample map, the central idea selected', () => {
    render(<App />)
    expect(names()).toEqual([
      'Learn React',
      'Basics', 'JSX', 'Components', 'Props',
      'Effects', 'useEffect', 'Cleanup',
      'State', 'useState', 'useReducer', 'Lifting state up',
      'Tooling', 'Vite', 'TypeScript', 'Vitest',
    ])
    expect(selectedName()).toBe('Learn React')
    expect(item('Learn React').getAttribute('aria-level')).toBe('1')
    expect(item('JSX').getAttribute('aria-level')).toBe('3')
  })

  it('adds a child with Tab and saves it with Enter', () => {
    render(<App />)
    select('Basics')
    press('Tab')
    expect(document.activeElement).toBe(editor())
    type('Hooks')
    expect(selectedName()).toBe('Hooks')
    expect(document.activeElement).toBe(tree())
    expect(saved().nodes[saved().nodes.n1.children.at(-1)].text).toBe('Hooks')
  })

  it('adds a sibling with Enter, and Tab while typing goes on to a child', () => {
    render(<App />)
    select('JSX')
    press('Enter')
    type('Fragments', 'Tab')
    type('<>…</>')
    expect(names().slice(1, 7)).toEqual(['Basics', 'JSX', 'Fragments', '<>…</>', 'Components', 'Props'])
    expect(item('<>…</>').getAttribute('aria-level')).toBe('4')
  })

  it('takes a new node away when it is cancelled or left empty', () => {
    render(<App />)
    select('Props')
    press('Enter')
    fireEvent.keyDown(editor(), { key: 'Escape' })
    press('Tab')
    type('   ')
    expect(names()).toHaveLength(16)
    expect(selectedName()).toBe('Props')
    // Neither left anything to undo.
    expect((button('Undo') as HTMLButtonElement).disabled).toBe(true)
  })

  it('renames with Space, and Escape keeps the old text', () => {
    render(<App />)
    select('Vite')
    press(' ')
    expect((editor() as HTMLTextAreaElement).value).toBe('Vite')
    type('Vite 8')
    expect(item('Vite 8')).toBeTruthy()
    press('F2')
    type('nope', 'Escape')
    expect(item('Vite 8')).toBeTruthy()
    fireEvent.doubleClick(item('Vite 8'))
    type('Vite')
    expect(item('Vite')).toBeTruthy()
  })

  it('saves an edit when the editor loses focus', () => {
    render(<App />)
    select('Cleanup')
    press('F2')
    fireEvent.change(editor(), { target: { value: 'Cleanup functions' } })
    fireEvent.blur(editor())
    expect(item('Cleanup functions')).toBeTruthy()
  })

  it('walks the map with the arrow keys', () => {
    render(<App />)
    select('Basics')
    press('ArrowRight')
    expect(selectedName()).toBe('Components')
    press('ArrowUp')
    expect(selectedName()).toBe('JSX')
    press('ArrowLeft')
    press('ArrowDown')
    expect(selectedName()).toBe('Effects')
    press('ArrowLeft')
    expect(selectedName()).toBe('Learn React')
    press('ArrowLeft')
    expect(['State', 'Tooling']).toContain(selectedName())
  })

  it('moves an idea among its siblings with Alt+arrows', () => {
    render(<App />)
    select('Props')
    press('ArrowUp', { altKey: true })
    expect(names().slice(2, 5)).toEqual(['JSX', 'Props', 'Components'])
  })

  it('deletes a branch, then undoes and redoes it', () => {
    render(<App />)
    select('State')
    press('Delete')
    expect(names()).not.toContain('useReducer')
    expect(status()).toBe('Deleted “State” and 3 more')
    expect(selectedName()).toBe('Tooling')
    press('z', { ctrlKey: true })
    expect(names()).toContain('useReducer')
    press('z', { metaKey: true, shiftKey: true })
    expect(names()).not.toContain('useReducer')
    fireEvent.click(button('Undo'))
    expect(names()).toContain('useReducer')
    fireEvent.click(button('Redo'))
    expect(names()).not.toContain('State')
  })

  it('keeps the central idea', () => {
    render(<App />)
    press('Delete')
    expect(names()).toHaveLength(16)
    expect((button('Delete') as HTMLButtonElement).disabled).toBe(true)
  })

  it('folds and unfolds a branch', () => {
    render(<App />)
    select('Tooling')
    press('c')
    expect(names()).not.toContain('Vitest')
    expect(item('Tooling').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button('Expand Tooling (3 hidden)'))
    expect(names()).toContain('Vitest')
    fireEvent.click(button('Fold branch'))
    expect(names()).not.toContain('Vite')
    // Stepping into a folded branch opens it.
    press('ArrowLeft')
    expect(names()).toContain('Vite')
  })

  it('selects the folded parent when the selection gets hidden', () => {
    render(<App />)
    select('Vite')
    fireEvent.click(button('Collapse Tooling'))
    expect(selectedName()).toBe('Tooling')
  })

  it('colours a branch with the number keys and the colour menu', () => {
    render(<App />)
    select('JSX')
    press('6')
    expect(item('JSX').getAttribute('style')).toContain('--branch: var(--branch-5)')
    press('0')
    expect(item('JSX').getAttribute('style')).toContain('--branch: var(--branch-0)')
    select('Basics')
    fireEvent.click(button('Branch colour'))
    fireEvent.click(screen.getByRole('menuitem', { name: /^Teal/ }))
    // Children inherit their branch's colour.
    expect(item('Props').getAttribute('style')).toContain('--branch: var(--branch-4)')
    expect(saved().nodes.n1.color).toBe(4)
  })

  it('drags an idea with its branch, as one undo step', () => {
    render(<App />)
    const left = (name: string) => parseFloat(item(name).style.left)
    const before = { basics: left('Basics'), jsx: left('JSX'), state: left('State') }
    const node = item('Basics')
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(tree(), { pointerId: 1, clientX: 130, clientY: 110 })
    fireEvent.pointerMove(tree(), { pointerId: 1, clientX: 160, clientY: 120 })
    fireEvent.pointerUp(tree(), { pointerId: 1, clientX: 160, clientY: 120 })
    expect(left('Basics') - before.basics).toBe(60)
    expect(left('JSX') - before.jsx).toBe(60)
    expect(left('State')).toBe(before.state)
    expect(saved().nodes.n1).toMatchObject({ dx: 60, dy: 20 })
    fireEvent.click(button('Undo'))
    expect(left('Basics')).toBe(before.basics)
    expect((button('Undo') as HTMLButtonElement).disabled).toBe(true)
  })

  it('tidies the layout back to automatic', () => {
    render(<App />)
    const start = item('Basics').style.left
    fireEvent.pointerDown(item('Basics'), { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(tree(), { pointerId: 1, clientX: 50, clientY: 0 })
    fireEvent.pointerUp(tree(), { pointerId: 1, clientX: 50, clientY: 0 })
    expect(item('Basics').style.left).not.toBe(start)
    fireEvent.click(button('Map menu'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tidy layout' }))
    expect(item('Basics').style.left).toBe(start)
  })

  it('moves a top-level branch to the other side', () => {
    render(<App />)
    select('Basics')
    const x = parseFloat(item('Basics').style.left)
    fireEvent.click(button('Move to the other side'))
    expect(parseFloat(item('Basics').style.left)).toBeLessThan(x)
    expect(saved().nodes.n1.side).toBe('left')
  })

  it('zooms with the buttons and keys', () => {
    render(<App />)
    fireEvent.click(button('Zoom in'))
    expect(button('Zoom 125%, reset to 100%')).toBeTruthy()
    press('-')
    press('-')
    expect(button('Zoom 80%, reset to 100%')).toBeTruthy()
    fireEvent.click(button('Zoom 80%, reset to 100%'))
    expect(button('Zoom 100%, reset to 100%')).toBeTruthy()
  })

  it('remembers the map across reloads', () => {
    const { unmount } = render(<App />)
    select('Tooling')
    press('Tab')
    type('pnpm')
    unmount()
    render(<App />)
    expect(item('pnpm')).toBeTruthy()
  })

  it('opens the sample when the saved map is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{"root":"root","nodes":{"root":{"text":1}}}')
    render(<App />)
    expect(item('Learn React')).toBeTruthy()
  })

  it('starts a new map that undo can take back', () => {
    render(<App />)
    fireEvent.click(button('Map menu'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New map' }))
    expect((editor() as HTMLTextAreaElement).value).toBe('Central idea')
    type('Holiday')
    expect(names()).toEqual(['Holiday'])
    fireEvent.click(button('Undo'))
    fireEvent.click(button('Undo'))
    expect(names()).toContain('Learn React')
  })

  it('exports the map as JSON and imports it back', async () => {
    let blob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b as Blob
      return 'blob:x'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    fireEvent.click(button('Map menu'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export JSON' }))
    const json = await blob!.text()
    expect(JSON.parse(json)).toMatchObject({ app: 'mind-map', version: 1, map: { root: 'root' } })

    select('Basics')
    press('Delete')
    const input = screen.getByLabelText('Import JSON file')
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([json], 'learn-react.json')] } })
    })
    await waitFor(() => expect(names()).toContain('Basics'))
    expect(status()).toBe('Opened “Learn React”. Undo goes back.')
  })

  it('rejects a file that is not a mind map', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Import JSON file'), {
        target: { files: [new File(['{"hello": 1}'], 'other.json')] },
      })
    })
    await waitFor(() => expect(status()).toBe('“other.json” isn\'t a mind map file.'))
    expect(names()).toHaveLength(16)
  })

  it('shows the shortcuts with ?', () => {
    render(<App />)
    press('?')
    expect(screen.getByRole('dialog', { name: 'Keyboard and mouse' })).toBeTruthy()
  })
})
