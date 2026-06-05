# Multi-Task Lists

A dependency-gated, dual-face to-do board for Windows. Tasks live in lists; lists live in sections; pink connectors wire tasks together across lists — and the wiring is *load-bearing*: an item can't be checked until everything it depends on is done.

Built with Electron + React (Vite), packaged as a single portable `.exe`.

## The two faces

Flip between them with the `⇄` button (top-left).

**Front** — starts blank. The **Create List** button (top-middle) offers three section roles:

| Role | Limit | Shape |
|---|---|---|
| **Top** | 0–1 | Full-width red band across the top |
| **Middle** | unlimited | Side-by-side color-coded columns |
| **Bottom** | 0–1 | Full-width red band across the bottom |

Any combination works (a lone Bottom section is a glorified one-item to-do list, but it's allowed). Section boundaries are draggable: hover the button band of any non-first section and the cursor turns to ↕ — drag to resize. Sizes persist.

**Back** — a single section of unlimited white lists, with its own Create List button. Same rules, no color coding.

## Rules

- **Sequential gating** — an item is checkable only when every item above it in its list *and* the link-partners of those items are complete.
- **Bottom band** — gated by its *own* connectors: whatever you wire it to must be fully complete first (transitively, that usually means everything).
- **Top band** — the mirror image: any list wired to the top band can't start until the *entire* top band is complete.
- **Connectors** — every card has four ports (edge midpoints). Click or drag port-to-port to wire two tasks. Lines are double-headed chevrons drawn *underneath* the cards, so they can never cross text. Right-click a line (or a port) to delete it.
- **Connector legality** — adjacent lists only; the top band attaches to a middle list's *first* item, the bottom band to its *last*; top↔bottom requires the top band's last item.
- **Unchecking** — only the most recently completed item of each list can be unchecked.
- **Silent failure** — anything illegal (checking a gated item, wiring a forbidden pair) simply does nothing. No error dialogs, ever.

## Interactions

| Action | How |
|---|---|
| Add task | `+` at a section's top-right (opens in edit mode) |
| Edit task | Double-click its text · Enter/blur commits · Esc cancels |
| Delete task | Hover → click the gray `×` (top-right), or clear its text |
| Reorder | Drag the `≡` handle |
| Wire a dependency | Click/drag from one port to another |
| Remove a dependency | Right-click the line or an endpoint port |
| Undo | Ctrl+Z (board changes; boundary resizes excluded) |
| Resize sections | Drag the button band of any non-first section |

Checked items fade to 75%. Gated checkboxes render gray (text stays full-brightness). Complete *everything* on the visible face and the background becomes an animated rainbow plasma. You earned it.

## State

Auto-saved (350 ms debounce) to `state.json` **next to the exe** — the app is fully portable; move the folder and your board moves with it. No save button exists. Ctrl+Z then auto-saves the rollback too.

## Building

Prereqs: Node 20+ on Windows.

```powershell
npm install
npm run build   # Vite → dist/
npm run dist    # electron-builder → release/MultiTaskLists.exe (portable)
```

The exe in `release/` is self-contained — copy it anywhere and run.

Notes:
- `build/icon.ico` supplies the exe/window icon. If you build without one, remove the `win.icon` line from `package.json`'s `build` section and electron-builder will use the default Electron icon.
- Dev modes: `npm run dev` runs the UI in a browser with localStorage persistence; `npx electron .` (after `npm run build`) runs the real shell with `state.json` written to the project folder.

## Stack

React 18 · Vite 6 · Electron 35 · @dnd-kit (drag reorder) · plain CSS · zero backend
