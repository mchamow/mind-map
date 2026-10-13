import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import {
  ArrowLeftRight,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  EllipsisVertical,
  FileDown,
  FilePlus2,
  FileUp,
  GitBranchPlus,
  ImageDown,
  ListPlus,
  Palette,
  Pencil,
  Redo2,
  Scan,
  Trash2,
  Undo2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { renderPng } from './exportPng'
import { HelpDialog } from './HelpDialog'
import { layout } from './layout'
import { branchVar } from './colors'
import { MapCanvas, type Editing } from './MapCanvas'
import {
  addChild,
  addSibling,
  colorOf,
  COLOR_NAMES,
  depth,
  descendants,
  flipSide,
  newMap,
  parseMap,
  removeNode,
  rename,
  reorder,
  resetLayout,
  selectionAfterRemove,
  setCollapsed,
  setColor,
  setOffset,
  toggleCollapsed,
  visibleAncestor,
  type MindMap,
} from './map'
import { useMeasure } from './measure'
import { navigate, type Arrow } from './navigate'
import { useMindMap } from './useMindMap'
import { fit, reveal, zoomAt, type View } from './view'

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

function Hint({ label, keys, children }: { label: string; keys?: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>
        {label} {keys && <Kbd>{keys}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function newId(map: MindMap) {
  let id: string
  do id = `n${Math.random().toString(36).slice(2, 9)}`
  while (map.nodes[id])
  return id
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'mind-map'

export default function App() {
  const { map, canUndo, canRedo, dispatch } = useMindMap()
  const measure = useMeasure()
  // The node the user picked; if a fold hides it, the folded ancestor shows as selected instead.
  const [picked, setPicked] = useState(map.root)
  const selected = visibleAncestor(map, picked)
  const [editing, setEditingState] = useState<Editing | null>(null)
  // Handlers read the live edit through a ref: a blur and a key press can both end it in one tick.
  const editingRef = useRef<Editing | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [helpOpen, setHelpOpen] = useState(false)
  const [message, setMessage] = useState('')
  const treeRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  /** Fit the whole map into view on the next layout (first load, a new or imported map). */
  const fitNext = useRef(true)
  const dragCount = useRef(0)

  const setEditing = (e: Editing | null) => {
    editingRef.current = e
    setEditingState(e)
  }

  const lay = useMemo(
    () => layout(map, measure, (id) => (editing?.id === id ? editing.draft : undefined)),
    [map, measure, editing],
  )

  useLayoutEffect(() => {
    if (fitNext.current && size.width > 0) {
      fitNext.current = false
      // Not below 60%: on a phone, a readable map you can pan beats a whole one you can't read.
      setView(fit(lay.bounds, size, { minZoom: 0.6 }))
    }
  }, [lay, size])

  // Keep the selected node on screen when the selection moves or an edit starts (not while a drag moves it).
  const selectedBox = lay.boxes[selected]
  const revealed = useRef('')
  useLayoutEffect(() => {
    const key = `${selected}|${editing?.id ?? ''}`
    if (revealed.current === key || !selectedBox || size.width === 0) return
    revealed.current = key
    setView((v) => reveal(v, selectedBox, size))
  }, [selected, editing?.id, selectedBox, size])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(t)
  }, [message])

  const change = (value: (m: MindMap) => MindMap, group?: string) => dispatch({ type: 'set', value, group })
  const focusTree = () => treeRef.current?.focus({ preventScroll: true })

  const node = map.nodes[selected]
  const isRoot = selected === map.root
  const level = depth(map, selected)

  function startEdit(id: string) {
    setPicked(id)
    setEditing({ id, draft: map.nodes[id].text, isNew: false, prev: id })
  }

  /** Saves the edit in progress. An empty new node is taken away again. */
  function commitEdit(id = editingRef.current?.id) {
    const e = editingRef.current
    if (!e || e.id !== id) return
    setEditing(null)
    const text = e.draft.trim()
    if (!text) {
      if (e.isNew) {
        dispatch({ type: 'drop' })
        setPicked(e.prev)
      }
      return
    }
    // A new node and its first text are one undo step.
    change((m) => rename(m, e.id, text), e.isNew ? `new:${e.id}` : undefined)
    dispatch({ type: 'commit' })
  }

  function cancelEdit() {
    const e = editingRef.current
    if (!e) return
    setEditing(null)
    if (e.isNew) {
      dispatch({ type: 'drop' })
      setPicked(e.prev)
    }
  }

  function add(kind: 'child' | 'sibling', from = selected) {
    const id = newId(map)
    change((m) => (kind === 'child' ? addChild(m, from, id) : addSibling(m, from, id)), `new:${id}`)
    setPicked(id)
    setEditing({ id, draft: '', isNew: true, prev: from })
  }

  function remove() {
    if (isRoot) {
      setMessage('The central idea stays; rename it instead.')
      return
    }
    const more = descendants(map, selected).length
    const next = selectionAfterRemove(map, selected)
    change((m) => removeNode(m, selected))
    setPicked(next)
    setMessage(`Deleted “${node.text}”${more ? ` and ${more} more` : ''}`)
  }

  function toggle(id: string) {
    const n = map.nodes[id]
    if (id === map.root || !n.children.length) return
    change((m) => toggleCollapsed(m, id))
    setPicked(id)
    setMessage(n.collapsed ? `Expanded “${n.text}”` : `Folded “${n.text}” (${descendants(map, id).length} hidden)`)
  }

  function recolor(color: number | undefined) {
    if (isRoot || (color === undefined && level === 1)) return
    change((m) => setColor(m, selected, color))
  }

  const zoomBy = (factor: number) => setView((v) => zoomAt(v, v.k * factor, size.width / 2, size.height / 2))
  const fitView = () => setView(fit(lay.bounds, size))

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key
    if (mod && key.toLowerCase() === 'z') {
      e.preventDefault()
      dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
      return
    }
    if (mod && key.toLowerCase() === 'y') {
      e.preventDefault()
      dispatch({ type: 'redo' })
      return
    }
    if (mod) return

    let handled = true
    if (key.startsWith('Arrow') && e.altKey) {
      if (key === 'ArrowUp' || key === 'ArrowDown') change((m) => reorder(m, selected, key === 'ArrowUp' ? -1 : 1))
    } else if (key.startsWith('Arrow')) {
      const move = navigate(map, lay.boxes, selected, key as Arrow)
      if (move.expand) change((m) => setCollapsed(m, move.expand!, false))
      setPicked(move.to)
    } else if (key === 'Tab' && !e.shiftKey) add('child')
    else if (key === 'Enter') add('sibling')
    else if (key === ' ' || key === 'F2') startEdit(selected)
    else if (key === 'Delete' || key === 'Backspace') remove()
    else if (key === 'c' || key === 'C') toggle(selected)
    else if (key === '+' || key === '=') zoomBy(1.25)
    else if (key === '-' || key === '_') zoomBy(0.8)
    else if (key === 'f' || key === 'F') fitView()
    else if (key === '?') setHelpOpen(true)
    else if (/^[0-8]$/.test(key)) recolor(key === '0' ? undefined : Number(key) - 1)
    else handled = false
    if (handled) e.preventDefault()
  }

  function onEditKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    e.stopPropagation()
    const current = editingRef.current
    if (!current) return
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
      focusTree()
    } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      commitEdit()
      focusTree()
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Save and carry on with a child idea: quick outlining without touching the mouse.
      e.preventDefault()
      if (!current.draft.trim()) return
      commitEdit()
      add('child', current.id)
    }
  }

  function exportJson() {
    const json = JSON.stringify({ app: 'mind-map', version: 1, map }, null, 2)
    download(`${slug(map.nodes[map.root].text)}.json`, new Blob([json], { type: 'application/json' }))
  }

  async function exportPng() {
    const blob = await renderPng(lay)
    if (blob) download(`${slug(map.nodes[map.root].text)}.png`, blob)
    else setMessage('Could not draw the image in this browser.')
  }

  async function importFile(file: File) {
    let imported: MindMap | null = null
    try {
      imported = parseMap(JSON.parse(await file.text()))
    } catch {
      // Not JSON: reported below.
    }
    if (!imported) {
      setMessage(`“${file.name}” isn't a mind map file.`)
      return
    }
    const m = imported
    change(() => m)
    setPicked(m.root)
    fitNext.current = true
    setMessage(`Opened “${m.nodes[m.root].text}”. Undo goes back.`)
  }

  function startNew() {
    change(() => newMap())
    fitNext.current = true
    setPicked('root')
    setEditing({ id: 'root', draft: 'Central idea', isNew: false, prev: 'root' })
    setMessage('New map. Undo brings the old one back.')
  }

  const ownColor = node.color
  const parentColor = node.parent ? colorOf(map, node.parent) : undefined

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <header className="flex items-center gap-2 border-b px-3 py-2 sm:px-4">
          <h1 className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight">
            <span aria-hidden="true">🧠</span>
            <span className="max-sm:sr-only">Mind Map</span>
          </h1>
          <p className="min-w-0 truncate text-sm text-muted-foreground max-md:hidden">
            <span aria-hidden="true">· </span>
            {map.nodes[map.root].text}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <Hint label="Undo" keys={`${MOD} Z`}>
              <Button variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })}>
                <Undo2 />
              </Button>
            </Hint>
            <Hint label="Redo" keys={`${MOD} ⇧ Z`}>
              <Button variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={() => dispatch({ type: 'redo' })}>
                <Redo2 />
              </Button>
            </Hint>
            <Separator orientation="vertical" className="mx-1 h-5 self-center" />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Map menu" />}>
                <EllipsisVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={exportPng}>
                  <ImageDown /> Export PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJson}>
                  <FileDown /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                  <FileUp /> Import JSON…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => change(resetLayout)}>
                  <WandSparkles /> Tidy layout
                </DropdownMenuItem>
                <DropdownMenuItem onClick={startNew}>
                  <FilePlus2 /> New map
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Hint label="Shortcuts" keys="?">
              <Button variant="ghost" size="icon" aria-label="Help" onClick={() => setHelpOpen(true)}>
                <CircleHelp />
              </Button>
            </Hint>
          </div>
        </header>

        <main className="relative flex-1">
          <MapCanvas
            map={map}
            layout={lay}
            selected={selected}
            editing={editing}
            view={view}
            treeRef={treeRef}
            onView={setView}
            onSize={setSize}
            onSelect={(id) => setPicked(id)}
            onEdit={startEdit}
            onDraft={(draft) => editing && setEditing({ ...editing, draft })}
            onEditKey={onEditKey}
            onEditBlur={commitEdit}
            onDrag={(id, dx, dy) => change((m) => setOffset(m, id, dx, dy), `drag:${dragCount.current}`)}
            onDragEnd={() => {
              dragCount.current++
              dispatch({ type: 'commit' })
            }}
            onToggle={toggle}
            onKeyDown={onKeyDown}
          />

          <p className="pointer-events-none absolute top-3 left-4 text-xs text-muted-foreground max-md:hidden">
            <Kbd>Tab</Kbd> child · <Kbd>Enter</Kbd> sibling · <Kbd>Space</Kbd> rename · <Kbd>?</Kbd> all shortcuts
          </p>

          <p
            role="status"
            className="pointer-events-none absolute top-3 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full border bg-popover px-3 py-1 text-sm text-popover-foreground shadow-sm empty:hidden"
          >
            {message}
          </p>

          <div
            role="toolbar"
            aria-label="Selected idea"
            className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-xl border bg-card/90 p-1 shadow-lg backdrop-blur sm:left-1/2 sm:-translate-x-1/2"
          >
            <span className="flex max-w-44 items-center gap-2 truncate px-2 text-sm font-medium max-sm:hidden">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: isRoot ? 'var(--primary)' : branchVar(colorOf(map, selected)) }}
              />
              <span className="truncate">{(editing?.id === selected ? editing.draft : node.text) || 'Untitled'}</span>
            </span>
            <Separator orientation="vertical" className="mx-0.5 h-5 self-center max-sm:hidden" />
            <Hint label="Add child" keys="Tab">
              <Button variant="ghost" size="icon" aria-label="Add child" onClick={() => add('child')}>
                <GitBranchPlus />
              </Button>
            </Hint>
            <Hint label="Add sibling" keys="Enter">
              <Button variant="ghost" size="icon" aria-label="Add sibling" disabled={isRoot} onClick={() => add('sibling')}>
                <ListPlus />
              </Button>
            </Hint>
            <Hint label="Rename" keys="Space">
              <Button variant="ghost" size="icon" aria-label="Rename" onClick={() => startEdit(selected)}>
                <Pencil />
              </Button>
            </Hint>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Branch colour" disabled={isRoot} />}>
                <Palette />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-48">
                <DropdownMenuItem disabled={level === 1} onClick={() => recolor(undefined)}>
                  <span className="size-3.5 rounded-full border-2" style={{ borderColor: branchVar(parentColor) }} />
                  Same as parent
                  {ownColor === undefined && <Check className="ml-auto" />}
                  <DropdownMenuShortcut className={ownColor === undefined ? 'ml-1' : undefined}>0</DropdownMenuShortcut>
                </DropdownMenuItem>
                {COLOR_NAMES.map((name, i) => (
                  <DropdownMenuItem key={name} onClick={() => recolor(i)}>
                    <span className="size-3.5 rounded-full" style={{ background: branchVar(i) }} />
                    {name}
                    {ownColor === i && <Check className="ml-auto" />}
                    <DropdownMenuShortcut className={ownColor === i ? 'ml-1' : undefined}>{i + 1}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Hint label={node.collapsed ? 'Unfold branch' : 'Fold branch'} keys="C">
              <Button
                variant="ghost"
                size="icon"
                aria-label={node.collapsed ? 'Unfold branch' : 'Fold branch'}
                disabled={isRoot || !node.children.length}
                onClick={() => toggle(selected)}
              >
                {node.collapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
              </Button>
            </Hint>
            <Hint label="Move to the other side">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Move to the other side"
                disabled={level !== 1}
                onClick={() => change((m) => flipSide(m, selected))}
              >
                <ArrowLeftRight />
              </Button>
            </Hint>
            <Hint label="Delete" keys="Del">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                disabled={isRoot}
                onClick={remove}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </Hint>
          </div>

          <div
            role="toolbar"
            aria-label="Zoom"
            aria-orientation="vertical"
            className="absolute right-4 bottom-4 flex flex-col items-center gap-0.5 rounded-xl border bg-card/90 p-1 shadow-lg backdrop-blur"
          >
            <Hint label="Zoom in" keys="+">
              <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
                <ZoomIn />
              </Button>
            </Hint>
            <Hint label="Reset to 100%">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Zoom ${Math.round(view.k * 100)}%, reset to 100%`}
                className="h-7 w-8 px-0 text-[11px] tabular-nums"
                onClick={() => setView((v) => zoomAt(v, 1, size.width / 2, size.height / 2))}
              >
                {Math.round(view.k * 100)}%
              </Button>
            </Hint>
            <Hint label="Zoom out" keys="−">
              <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoomBy(0.8)}>
                <ZoomOut />
              </Button>
            </Hint>
            <Hint label="Fit map" keys="F">
              <Button variant="ghost" size="icon" aria-label="Fit map" onClick={fitView}>
                <Scan />
              </Button>
            </Hint>
          </div>
        </main>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          aria-label="Import JSON file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importFile(file)
            e.target.value = ''
          }}
        />
        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} mod={MOD} />
      </div>
    </TooltipProvider>
  )
}
