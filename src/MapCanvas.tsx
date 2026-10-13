import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { branchVar } from './colors'
import { FOLD_SIZE, levelOf, type Box, type Layout } from './layout'
import type { MindMap } from './map'
import { zoomAt, type View } from './view'

export type Editing = {
  id: string
  draft: string
  /** A node just added: cancelling or leaving it empty takes it away again. */
  isNew: boolean
  /** What was selected before, to go back to when a new node is cancelled. */
  prev: string
}

type Size = { width: number; height: number }

type Gesture =
  | { kind: 'pan'; x: number; y: number; view: View }
  | { kind: 'node'; id: string; x: number; y: number; dx: number; dy: number; moved: boolean }
  | { kind: 'pinch'; dist: number; mid: { x: number; y: number }; view: View }

/** Pixels a pointer has to travel before a press on a node becomes a drag. */
const DRAG_THRESHOLD = 4
const BORDER = [0, 2, 1]

function nodeStyle(b: Box): CSSProperties {
  const level = levelOf(b.depth)
  const border = BORDER[Math.min(b.depth, 2)]
  const branch = branchVar(b.color)
  return {
    left: b.x - b.w / 2,
    top: b.y - b.h / 2,
    width: b.w,
    height: b.h,
    font: level.font,
    lineHeight: `${level.lineHeight}px`,
    padding: `${level.padY - border}px ${level.padX - border}px`,
    borderWidth: border,
    ['--branch' as string]: b.depth === 0 ? 'var(--foreground)' : branch,
    ...(b.depth === 1 && {
      borderColor: branch,
      background: `color-mix(in oklab, ${branch} 14%, var(--card))`,
    }),
    ...(b.depth >= 2 && { borderColor: `color-mix(in oklab, ${branch} 45%, var(--border))` }),
  }
}

type Props = {
  map: MindMap
  layout: Layout
  selected: string
  editing: Editing | null
  view: View
  treeRef: RefObject<HTMLDivElement | null>
  onView: (update: (v: View) => View) => void
  onSize: (size: Size) => void
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDraft: (draft: string) => void
  onEditKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  /** The editor of this node lost focus (by then another node may be the one being edited). */
  onEditBlur: (id: string) => void
  /** A node dragged to a new manual offset (absolute, in map units). */
  onDrag: (id: string, dx: number, dy: number) => void
  onDragEnd: () => void
  onToggle: (id: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}

export function MapCanvas(props: Props) {
  const { map, layout, selected, editing, view, treeRef, onView, onSize } = props
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)

  useEffect(() => {
    const el = treeRef.current
    if (!el) return
    const measure = () => onSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    // Wheel pans; pinch (or Ctrl/⌘ + wheel) zooms at the pointer. Non-passive, to keep the page from scrolling.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const scale = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp((-e.deltaY * scale) / 250)
        onView((v) => zoomAt(v, v.k * factor, e.clientX - rect.left, e.clientY - rect.top))
      } else {
        onView((v) => ({ ...v, x: v.x - e.deltaX * scale, y: v.y - e.deltaY * scale }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [treeRef, onView, onSize])

  const local = (e: PointerEvent) => {
    const rect = treeRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const endNodeDrag = () => {
    const g = gesture.current
    if (g?.kind === 'node' && g.moved) props.onDragEnd()
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button, textarea') || (e.pointerType === 'mouse' && e.button !== 0)) return
    treeRef.current!.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = local(e)
    pointers.current.set(e.pointerId, p)

    if (pointers.current.size === 2) {
      endNodeDrag()
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view,
      }
      return
    }
    const id = target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    if (id) {
      props.onSelect(id)
      const n = map.nodes[id]
      gesture.current = { kind: 'node', id, x: p.x, y: p.y, dx: n.dx ?? 0, dy: n.dy ?? 0, moved: false }
    } else {
      gesture.current = { kind: 'pan', x: p.x, y: p.y, view }
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()]
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const zoomed = zoomAt(g.view, (g.view.k * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist, g.mid.x, g.mid.y)
      onView(() => ({ ...zoomed, x: zoomed.x + mid.x - g.mid.x, y: zoomed.y + mid.y - g.mid.y }))
    } else if (g.kind === 'pan') {
      onView(() => ({ ...g.view, x: g.view.x + p.x - g.x, y: g.view.y + p.y - g.y }))
    } else {
      if (!g.moved && Math.hypot(p.x - g.x, p.y - g.y) < DRAG_THRESHOLD) return
      g.moved = true
      props.onDrag(g.id, g.dx + (p.x - g.x) / view.k, g.dy + (p.y - g.y) / view.k)
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    endNodeDrag()
    // Lifting one finger of a pinch carries on as a pan with the other.
    const rest = [...pointers.current.values()][0]
    gesture.current = rest ? { kind: 'pan', x: rest.x, y: rest.y, view } : null
  }

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label="Mind map"
      aria-activedescendant={`node-${selected}`}
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        // Pointer capture retargets the click to the canvas, so find the node under the pointer.
        const hit = document.elementFromPoint?.(e.clientX, e.clientY) ?? (e.target as Element)
        const id = hit.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
        if (id && !editing) props.onEdit(id)
      }}
      className="absolute inset-0 cursor-default touch-none overflow-hidden outline-none select-none"
      style={{
        backgroundImage: 'radial-gradient(circle, var(--dot) 1px, transparent 1.2px)',
        backgroundSize: `${24 * view.k}px ${24 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        <svg className="absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
          {layout.edges.map((e) => (
            <path
              key={e.id}
              d={e.d}
              fill="none"
              stroke={branchVar(e.color)}
              strokeWidth={e.depth === 1 ? 3 : 2}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {layout.order.map((id) => {
          const b = layout.boxes[id]
          const node = map.nodes[id]
          const isSelected = id === selected
          const isEditing = editing?.id === id
          const level = levelOf(b.depth)
          return (
            <div key={id} className="group/node contents">
              <div
                id={`node-${id}`}
                role="treeitem"
                aria-level={b.depth + 1}
                aria-selected={isSelected}
                aria-expanded={b.hasChildren && b.depth > 0 ? !node.collapsed : undefined}
                data-node-id={id}
                className={cn(
                  'absolute flex flex-col justify-center border-solid whitespace-pre transition-shadow',
                  b.depth === 0 && 'rounded-2xl bg-primary text-center text-primary-foreground shadow-md',
                  b.depth === 1 && 'rounded-xl text-foreground shadow-xs',
                  b.depth >= 2 && 'rounded-lg bg-card text-card-foreground',
                  isSelected && 'ring-2 ring-(--branch) ring-offset-2 ring-offset-background',
                  isEditing ? 'cursor-text' : 'cursor-grab active:cursor-grabbing',
                )}
                style={nodeStyle(b)}
              >
                {isEditing ? (
                  <textarea
                    aria-label="Node text"
                    autoFocus
                    rows={1}
                    spellCheck={false}
                    value={editing.draft}
                    placeholder="Idea"
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => props.onDraft(e.target.value)}
                    onKeyDown={props.onEditKey}
                    onBlur={() => props.onEditBlur(id)}
                    className={cn(
                      'h-full w-full resize-none overflow-hidden bg-transparent p-0 outline-none placeholder:opacity-50',
                      b.depth === 0 && 'text-center',
                    )}
                    style={{ font: level.font, lineHeight: `${level.lineHeight}px` }}
                  />
                ) : (
                  b.lines.map((line, i) => <span key={i}>{line || ' '}</span>)
                )}
              </div>
              {b.hasChildren && b.depth > 0 && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={b.hidden ? `Expand ${node.text} (${b.hidden} hidden)` : `Collapse ${node.text}`}
                  onClick={() => props.onToggle(id)}
                  className={cn(
                    'absolute flex items-center justify-center rounded-full border-2 bg-background text-[11px] leading-none font-semibold tabular-nums shadow-xs transition-opacity hover:bg-muted',
                    !b.hidden && !isSelected && 'opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100',
                  )}
                  style={{
                    left: b.dir > 0 ? b.x + b.w / 2 + 4 : b.x - b.w / 2 - 4 - FOLD_SIZE,
                    top: b.y - FOLD_SIZE / 2,
                    width: FOLD_SIZE,
                    height: FOLD_SIZE,
                    borderColor: branchVar(b.color),
                    color: branchVar(b.color),
                  }}
                >
                  {b.hidden ? (b.hidden > 99 ? '99+' : b.hidden) : <Minus className="size-3" strokeWidth={3} />}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
