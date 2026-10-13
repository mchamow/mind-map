# 🧠 Mind Map

[![Test and deploy](https://github.com/mchamow/mind-map/actions/workflows/deploy.yml/badge.svg)](https://github.com/mchamow/mind-map/actions/workflows/deploy.yml)

**Day 24 of [100 Days of React](https://github.com/mchamow?tab=repositories)**: Sketch ideas as a branching mind map on a pan-and-zoom canvas.

**Live demo:** https://mchamow.github.io/mind-map/

## Features

- **A central idea with branches on both sides**, laid out automatically: new top-level branches go to the lighter side and get their own colour
- **Keyboard outlining**: <kbd>Tab</kbd> adds a child, <kbd>Enter</kbd> a sibling, and <kbd>Tab</kbd> while typing saves and goes on to a child, so you can sketch a whole branch without the mouse
- **Inline editing**: <kbd>Space</kbd>, <kbd>F2</kbd> or double-click to rename. Text wraps onto several lines (<kbd>Shift</kbd>+<kbd>Enter</kbd> for a line break). <kbd>Esc</kbd> cancels, and a new idea left empty goes away again
- **Drag an idea** to nudge it and its whole branch; **Tidy layout** puts everything back
- **Pan and zoom**: drag the background or scroll to pan; pinch, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + scroll, the zoom buttons or <kbd>+</kbd> / <kbd>−</kbd> to zoom; <kbd>F</kbd> fits the map
- **Arrow keys walk the map as drawn**: away from the centre goes to a child, towards it to the parent, up/down to siblings; <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> reorders
- **Fold branches** (<kbd>C</kbd> or the button on a branch's edge); a folded branch shows how many ideas it hides
- **Eight branch colours** (<kbd>1</kbd>–<kbd>8</kbd>, or the colour menu); child ideas inherit their branch's colour unless they have their own
- **Undo / redo** for everything (a whole drag is one step)
- **Export** a 2× PNG (in the current theme) or JSON, and **import** JSON back
- Saved in `localStorage` as you go; starts with a small "Learn React" sample
- Light and dark themes, and a phone layout with touch drag, pan and pinch zoom

## How it works

- [`src/map.ts`](src/map.ts): the map is a flat record of nodes (`parent`, `children`, optional side, colour, fold and manual offset). Every edit is a pure function that returns a new map, and `parseMap` checks saved or imported data really is one tree
- [`src/layout.ts`](src/layout.ts): measures and wraps each node's text, works out how tall each branch is, stacks children around their parent and draws curved edges between them. Text is measured with a canvas in the app's font, so the layout knows node sizes before anything renders
- [`src/navigate.ts`](src/navigate.ts) and [`src/view.ts`](src/view.ts): arrow-key moves, and the pan/zoom maths (zoom about a point, fit, scroll a node into view)
- [`src/MapCanvas.tsx`](src/MapCanvas.tsx): one focusable ARIA `tree` with `aria-activedescendant`; pointer events handle dragging nodes, panning and two-finger pinch
- [`src/exportPng.ts`](src/exportPng.ts): redraws the layout onto a canvas using the theme's CSS colours

## Tech

React 19 · TypeScript · Vite · Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Base UI) · lucide icons · Vitest + Testing Library · deployed to GitHub Pages with GitHub Actions.

## Run locally

```bash
pnpm install
pnpm dev
pnpm test   # 78 unit and component tests (Vitest)
```
