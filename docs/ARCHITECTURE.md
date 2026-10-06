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

`src/game/` modules — all frame-stepped and deterministic; nothing here reads the DOM, the
clock, a timer or `Math.random`:

```
types.ts        the SimulationState / Buttons / Phase vocabulary
board.ts        the 10x22 grid (20 visible + 2 hidden rows), validity, lock, line clear
pieces.ts       the 19 NES orientations, the spawn orientation per piece, CW/CCW cycles
lfsr.ts         the 16-bit Fibonacci LFSR
randomiser.ts   spawnTable + the pure picker + the per-frame LFSR seam
gravity.ts      the 30-entry NTSC frames-per-cell table and its clamp
level.ts        the first-level-up table, then +10 lines
scoring.ts      base[lines] * (level + 1)
das.ts          the NTSC DAS constants (16 then 6)
timing.ts       the ONE place the `[W]` delays live (entry 96, ARE, line clear, soft drop)
simulation.ts   THE seam: createSimulation() -> { step, state, restart }
test-harness.ts TEST-ONLY: a 1-ply placement planner the pins drive the real frames with
```

## 2 · The one way to do X

| Seam | The ONE way | Where | Notes |
| --- | --- | --- | --- |
| Step the game one frame | `createSimulation(opts).step(held)` | `src/game/simulation.ts:63` (factory), `src/game/simulation.ts:313` (`step`) | Exactly one 60.0988 Hz frame per call; "newly pressed" is derived INSIDE from the previous frame's held set |
| Read the simulation | `createSimulation(opts).state` | `src/game/simulation.ts:63` | A fresh frozen snapshot on every read — safe to hold on to |
| Start a new round | `createSimulation(opts).restart()` | `src/game/simulation.ts:63` | Resets the round but NOT the LFSR / `spawnCount` / `spawnID` (§2 `$001A`) |
| Randomness | `stepLfsr` (accumulator) + `pick` (pure) | `src/game/lfsr.ts:8`, `src/game/randomiser.ts:48` | The frame loop calls `advanceFrame` (`src/game/randomiser.ts:31`) exactly once per frame; `pick` is a pure function of `(seed, spawnCount, spawnID)` |
| The spawn table | `SPAWN_TABLE` | `src/game/randomiser.ts:11` | 7 orientation ids; index 7 is the dummy that is always rejected |
| Piece shapes | `cellsOfOrientation` / `cellsAt` | `src/game/pieces.ts:93` | The 19 orientations, transcribed from §1 |
| Rotation | `rotateOrientation` (CW/CCW successor) | `src/game/pieces.ts:109` | Applied at the SAME `(x,y)`; a blocked rotation is refused with no kick (`src/game/simulation.ts:158`) |
| Spawn orientation | `SPAWN_ORIENTATION` | `src/game/pieces.ts:70` | NES spawns, not SRS |
| Collision / boundary | `isPositionValid` | `src/game/board.ts:47` | `x` 0..9, `y` -2..19; only destination cells are tested |
| Store a locked piece | `lockCells` | `src/game/board.ts:59` | Cells in `y < 0` are NOT stored (the piece is truncated) |
| Clear rows | `findFullRows` + `clearRows` | `src/game/board.ts:70`, `src/game/board.ts:83` | Visible rows only; the hidden rows are always empty |
| Gravity | `framesPerCell` | `src/game/gravity.ts:17` | 30-entry table, hard-clamped to 1 frame/cell at level 29+ |
| Level progression | `firstLevelUpLines` + `LINES_PER_LEVEL` | `src/game/level.ts:9` | The first advance is the §6 table; then +10 |
| The base score | `lockBaseScore` | `src/game/scoring.ts:12` | Called with the level AFTER the level-up check |
| DAS | `DAS_RESET_FRAMES` / `DAS_CHARGE_AFTER_SHIFT` | `src/game/das.ts:8` | 16 then 6; a blocked shift returns the counter to 16 |
| The `[W]` delays | `ENTRY_DELAY_FRAMES`, `SOFT_DROP_*`, `areFramesForLock`, `LINE_CLEAR_STEPS` | `src/game/timing.ts:16` | ONE place; every value is wiki-sourced `[W]`, NOT ROM-verified — see §4 |
| Drive the game in a test | `planPlacement` / `playPiece` | `src/game/test-harness.ts:158`, `src/game/test-harness.ts:215` | TEST-ONLY; the pins play real frames through the public `step` |

## 3 · `SimulationState` — the renderer's contract

Declared at `src/game/types.ts:78`. Every field is `readonly`, and `state` builds a new
snapshot on every read, so a consumer may keep one. The renderer slice consumes exactly
this and nothing else.

| Field | Type | Meaning |
| --- | --- | --- |
| `board` | `readonly (readonly number[])[]` | 22 rows × 10 columns of 0/1. **Row index = `y + 2`**: row 0 is `y = -2` (the top hidden row) and row 21 is `y = 19`. Slice `(2)` for the visible field. Rows 0–1 are never stored |
| `active` | `ActivePiece \| null` | `null` during `lineClear`, `are` and `gameOver`. `{ piece, orientationId, x, y, cells, valid }`; `cells` are ABSOLUTE board coordinates and may sit at `y = -1/-2`; `valid` is false for a spawn overlap |
| `next` | `PreviewPiece` | Exactly one preview (§9), always generated ahead. `{ piece, orientationId, cells }` where `cells` are `(dx,dy)` OFFSETS from the piece origin — the shape, not board coordinates |
| `score` | `number` | Plain integer (§12.1: the BCD bug is deliberately not reproduced) |
| `lines` | `number` | Total cleared lines |
| `level` | `number` | A-Type level |
| `phase` | `Phase` | `'entry' \| 'playing' \| 'lineClear' \| 'are' \| 'gameOver'` |
| `gameOver` | `boolean` | Set iff a piece LOCKED while invalid (§8) |
| `frame` | `number` | Frames stepped since the round began (0 before the first `step`) |
| `phaseFrames` | `number` | Frames left in the current delay phase; 0 otherwise |
| `lfsr` | `number` | The live 16-bit LFSR — the spawn frame is what decides the piece |
| `spawnCount` | `number` | `$001A`; NOT reset between games |
| `spawnId` | `number` | `$0019`, the previous spawn's orientation id |
| `das` | `DasState` | `{ direction: -1 \| 0 \| 1, counter }` — the counter survives release and ARE |
| `softDropCells` | `number` | Cells dropped by the CURRENT continuous soft drop |
| `softDropPoints` | `number` | Cumulative soft-drop points awarded (§5) |
| `linesAtNextLevel` | `number` | Total line count at which the next level-up fires |
| `gravityFramesPerCell` | `number` | `framesPerCell(level)` |

`Buttons` is `{ left, right, down, rotateCW, rotateCCW, up }` — what is HELD this frame.
Callers never pass edges.

## 4 · Gotchas

- **The board is 10×20 with two hidden rows above it** (`y = -2..-1`) that a piece may
  legally occupy. A piece that locks with cells there is TRUNCATED — those cells are not
  stored — so the stored grid is never anything but the visible 20 rows, and the §12.3
  hidden-row indexing bug cannot occur.
- **A blocked rotation is refused; there is no kick and no nudge.** Rotating the flat I on
  the floor therefore does nothing: orientation 17 would put a cell at `y = 20`. This is the
  NES "spin" — a piece can be rotated into a cavity, but never kicked out of one.
- **A spawn overlap is not a loss.** Game over happens only when a piece LOCKS while
  invalid, which is why an overlapping piece can sit there for a whole gravity period.
- **DAS is dead during ARE and the line-clear delay**: the counter neither charges nor
  resets there, and it is not reset at spawn, so a held direction carries its charge into
  the next piece.
- **A blocked shift leaves the DAS counter at 16**, so it retries on every frame while the
  piece is against the wall.
- **Horizontal shift is refused entirely while Down is held** — including the tap that would
  normally move one cell.
- **The `[W]` timings are wiki-sourced, not ROM-verified.** `entry 96`, `ARE 10..18`,
  `line-clear 17..20`, `soft drop 3 then 2` all live in `src/game/timing.ts` and are tagged
  there and here. Do not cite them as facts about the cartridge. Everything in
  `docs/NES-MECHANICS.md` §12 is deliberately not reproduced.

## 5 · Known debt

- **No renderer, input or storage yet.** `src/main.ts` still writes a version string; the
  simulation is complete but nothing draws it. The next slice consumes `SimulationState`.
- **`startingLevel` is an extra option on `createSimulation`.** The brief fixes the game at
  level 0; the option exists so the gravity and scoring rules of a later level are reachable
  from a test without scripting 100+ lines of play (level select is out of scope).
- **The test harness is a 1-ply greedy planner, not a player.** `src/game/test-harness.ts`
  is test-only; a future demo/attract mode must not reuse it without saying so.
