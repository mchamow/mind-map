import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

const SHORTCUTS: [string, string][] = [
  ['Tab', 'Add a child idea'],
  ['Enter', 'Add a sibling idea'],
  ['Space / F2', 'Rename (or double-click)'],
  ['Enter / Esc', 'While typing: save / cancel'],
  ['Shift Enter', 'While typing: new line'],
  ['Arrows', 'Move around the map'],
  ['Alt ↑ / ↓', 'Move an idea up or down'],
  ['C', 'Fold or unfold a branch'],
  ['1 – 8 / 0', 'Branch colour / same as parent'],
  ['Delete', 'Delete the idea and its branch'],
  ['Ctrl Z / Ctrl Shift Z', 'Undo / redo'],
  ['+ / − / F', 'Zoom in, out, fit the map'],
  ['?', 'This help'],
]

export function HelpDialog({ open, onOpenChange, mod }: { open: boolean; onOpenChange: (open: boolean) => void; mod: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard and mouse</DialogTitle>
          <DialogDescription>
            Drag an idea to move its branch, drag the background (or scroll) to pan, and pinch or {mod} + scroll to
            zoom. Everything is saved in this browser as you go.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="contents">
              <dt>
                <Kbd>{keys.replaceAll('Ctrl', mod)}</Kbd>
              </dt>
              <dd className="text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
