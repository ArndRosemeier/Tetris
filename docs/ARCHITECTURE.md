# Architecture — the seam index

The seam index answers *"how does this codebase work, and where is the ONE place that does
X?"* — the layer map, the seam rows, the gotchas and the known debt. It is what a brief is
scoped against and what a writer reads before touching an area.

The full contract is the Toolbox `docs/SEAM-INDEX.md`. An index entry is **checkable,
never prose**: `escapeHtml — src/lib/text.ts:14`, not "we agreed there is one way to do X".
Updated in the same commit as the change.

## 1 · Layer map

```
src/main.ts        the shell: mounts the app, wires the clock and input to the simulation
src/game/          the simulation — PURE, no DOM, no canvas, no wall-clock, no Math.random
src/render/        the renderer — draws game state, owns the canvas, never mutates state
src/input/         key/touch handling — translates events into one intent vocabulary
src/storage/       persisted state (settings, high score) — parse-validated at the boundary
```

Dependencies point **inward**: `main` → (`render`, `input`, `game`); `render` and `input`
may read `game` types; `game` depends on nothing above it and imports no browser API. A
slice that needs `game` to know about the DOM has the seam in the wrong place.

## 2 · The one way to do X

| Seam | The ONE way | Where | Notes |
| --- | --- | --- | --- |
| <the idea> | `<function/class/module>` | `<file:line>` | <what used to be duplicated, what bites> |

*No seam rows yet: the simulation does not exist. Rows land with the slices that create
them, in the same commit.*

## 3 · Gotchas

- **The board is 10×20 with a hidden spawn buffer above it** (a tetromino spawns partly
  outside the visible field). Anything that clamps to 20 rows without the buffer will
  reject a legal spawn.

## 4 · Known debt

- **The skeleton is a shell only.** `src/main.ts` writes a version string; no simulation,
  no renderer, no input. Everything below the layer map is debt until a slice lands.
