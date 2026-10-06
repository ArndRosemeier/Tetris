import { BOTTOM_Y, BOARD_WIDTH, VISIBLE_ROWS, clearRows, copyGrid, findFullRows, isPositionValid, lockCells, rowOf } from './board';
import type { Grid, GridView } from './board';
import { cellsAt, cellsOfOrientation, rotateOrientation } from './pieces';
import { stepLfsr } from './lfsr';
import { noButtons } from './simulation';
import type { Simulation } from './simulation';
import type { Buttons, OrientationId, SimulationState } from './types';

/** Steps the LFSR N times — the same seam the frame loop uses, without a simulation. */
export function stepLfsrTimes(state: number, times: number): number {
  let s = state;
  for (let i = 0; i < times; i++) s = stepLfsr(s);
  return s;
}

/**
 * TEST-ONLY. A deterministic placement planner that drives the real simulation through
 * real frames. Nothing in `src/game/` imports this file and it is not part of the
 * simulation seam — it exists so the pins can play a game without hand-scripting input.
 */

export type Strategy = 'flat' | 'tower';
export type Observer = (state: Readonly<SimulationState>) => void;

export interface Placement {
  readonly orientationId: OrientationId;
  readonly x: number;
  readonly y: number;
}

/** Columns the `tower` strategy is allowed to use — chosen so a row can never complete. */
const TOWER_MIN_COLUMN = 3;
const TOWER_MAX_COLUMN = 6;

/** El-Tetris (Dellacherie) weights — a well-understood evaluator, not a tuning exercise. */
const W_LANDING_HEIGHT = -4.500158825082766;
const W_ROWS_CLEARED = 3.4181268101392694;
const W_ROW_TRANSITIONS = -3.2178882868487753;
const W_COL_TRANSITIONS = -9.348695305445199;
const W_HOLES = -7.899265427351652;
const W_WELL_SUMS = -3.3855972247263626;

function columnHeights(grid: Grid): number[] {
  const heights: number[] = [];
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let h = 0;
    for (let y = 0; y <= BOTTOM_Y; y++) {
      if (grid[rowOf(y)]![x] === 1) {
        h = VISIBLE_ROWS - y;
        break;
      }
    }
    heights.push(h);
  }
  return heights;
}

function countHoles(grid: Grid): number {
  let holes = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let seenFilled = false;
    for (let y = 0; y <= BOTTOM_Y; y++) {
      if (grid[rowOf(y)]![x] === 1) seenFilled = true;
      else if (seenFilled) holes += 1;
    }
  }
  return holes;
}

function rowTransitions(grid: Grid): number {
  let transitions = 0;
  for (let y = 0; y <= BOTTOM_Y; y++) {
    let prev = true; // the wall counts as filled
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const filled = grid[rowOf(y)]![x] === 1;
      if (filled !== prev) transitions += 1;
      prev = filled;
    }
    if (!prev) transitions += 1; // the far wall
  }
  return transitions;
}

function colTransitions(grid: Grid): number {
  let transitions = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let prev = true; // the floor counts as filled
    for (let y = BOTTOM_Y; y >= 0; y--) {
      const filled = grid[rowOf(y)]![x] === 1;
      if (filled !== prev) transitions += 1;
      prev = filled;
    }
    if (!prev) transitions += 1; // the ceiling counts as empty
  }
  return transitions;
}

function wellSums(grid: Grid): number {
  let sum = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let depth = 0;
    for (let y = BOTTOM_Y; y >= 0; y--) {
      const filled = grid[rowOf(y)]![x] === 1;
      const leftFilled = x === 0 || grid[rowOf(y)]![x - 1] === 1;
      const rightFilled = x === BOARD_WIDTH - 1 || grid[rowOf(y)]![x + 1] === 1;
      if (!filled && leftFilled && rightFilled) {
        depth += 1;
        sum += depth;
      } else {
        depth = 0;
      }
    }
  }
  return sum;
}

function evaluate(grid: Grid, cleared: number, landingY: number): number {
  const heights = columnHeights(grid);
  const aggregate = heights.reduce((a, b) => a + b, 0);
  let bumpiness = 0;
  for (let x = 0; x < BOARD_WIDTH - 1; x++) bumpiness += Math.abs(heights[x]! - heights[x + 1]!);
  return (
    W_LANDING_HEIGHT * (VISIBLE_ROWS - landingY) +
    W_ROWS_CLEARED * cleared +
    W_ROW_TRANSITIONS * rowTransitions(grid) +
    W_COL_TRANSITIONS * colTransitions(grid) +
    W_HOLES * countHoles(grid) +
    W_WELL_SUMS * wellSums(grid) -
    0.1 * aggregate -
    0.2 * bumpiness
  );
}

/** The lowest resting y for an orientation in a column, or null if it cannot be placed. */
function landingY(grid: Grid, orientationId: OrientationId, x: number): number | null {
  for (let y = BOTTOM_Y; y >= -4; y--) {
    if (isPositionValid(grid, orientationId, x, y) && !isPositionValid(grid, orientationId, x, y + 1)) return y;
  }
  return null;
}

function orientationsFromSpawn(spawnId: OrientationId): OrientationId[] {
  const seen: OrientationId[] = [spawnId];
  let id = spawnId;
  for (let i = 0; i < 3; i++) {
    id = rotateOrientation(id, 1);
    if (!seen.includes(id)) seen.push(id);
  }
  return seen;
}

function withinTower(orientationId: OrientationId, x: number): boolean {
  return cellsOfOrientation(orientationId).every(
    (c) => x + c.x >= TOWER_MIN_COLUMN && x + c.x <= TOWER_MAX_COLUMN,
  );
}

export function planPlacement(
  board: GridView,
  spawnOrientationId: OrientationId,
  strategy: Strategy,
): Placement | null {
  const grid: Grid = copyGrid(board);
  const options: OrientationId[] = orientationsFromSpawn(spawnOrientationId);

  let best: Placement | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const orientationId of options) {
    for (let x = -2; x < BOARD_WIDTH + 2; x++) {
      if (strategy === 'tower' && !withinTower(orientationId, x)) continue;
      const y = landingY(grid, orientationId, x);
      if (y === null) continue;
      const after = copyGrid(grid);
      lockCells(after, cellsAt(orientationId, x, y));
      const full = findFullRows(after);
      if (full.length > 0) clearRows(after, full);
      const score =
        strategy === 'tower'
          ? -6 * countHoles(after) + 2 * columnHeights(after).reduce((a, b) => a + b, 0)
          : evaluate(after, full.length, y);
      if (score > bestScore) {
        bestScore = score;
        best = { orientationId, x, y };
      }
    }
  }

  // The tower strategy deliberately has NO fallback: once columns 3..6 are full to the
  // top there is no legal placement inside them, the piece soft-drops where it spawned
  // and locks invalid — which is exactly the top-out that pin 8 watches.
  return best;
}

function doStep(sim: Simulation, held: Buttons, observe?: Observer): void {
  sim.step(held);
  if (observe) observe(sim.state);
}

function tap(sim: Simulation, key: keyof Buttons, observe?: Observer): void {
  const held = noButtons();
  held[key] = true;
  doStep(sim, held, observe);
  doStep(sim, noButtons(), observe);
}

function waitForPiece(sim: Simulation, observe?: Observer): void {
  let guard = 0;
  while (!sim.state.active && !sim.state.gameOver && guard++ < 400) {
    doStep(sim, noButtons(), observe);
  }
}

/** Plays ONE piece: rotate, walk it to the planned column, then soft-drop it home. */
export function playPiece(sim: Simulation, strategy: Strategy, observe?: Observer): void {
  if (sim.state.gameOver) return;
  waitForPiece(sim, observe);
  const current = sim.state.active;
  if (!current || sim.state.gameOver) return;

  const plan = planPlacement(sim.state.board, current.orientationId, strategy);
  if (plan) {
    let guard = 0;
    while (sim.state.active && sim.state.active.orientationId !== plan.orientationId && guard++ < 8) {
      tap(sim, 'rotateCW', observe);
    }
    guard = 0;
    while (sim.state.active && sim.state.active.x !== plan.x && guard++ < 30) {
      tap(sim, sim.state.active.x < plan.x ? 'right' : 'left', observe);
    }
  }

  let guard = 0;
  while (sim.state.active && !sim.state.gameOver && guard++ < 400) {
    const held = noButtons();
    held.down = true;
    doStep(sim, held, observe);
  }
}
