import { cellsOfOrientation } from './pieces';
import type { Cell, OrientationId } from './types';

/**
 * The playfield: 10 columns x 20 VISIBLE rows, plus 2 hidden rows above
 * (`y = -2..-1`) that a piece may legally occupy (§10). Internally the grid has
 * `BOARD_HEIGHT = 22` rows where row index = `y + HIDDEN_ROWS`.
 */
export const BOARD_WIDTH = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 2;
export const BOARD_HEIGHT = VISIBLE_ROWS + HIDDEN_ROWS;

/** Legal y range for a piece cell, hidden rows included. */
export const TOP_Y = -HIDDEN_ROWS; // -2
export const BOTTOM_Y = VISIBLE_ROWS - 1; // 19

/** Spawn origin (§10). */
export const SPAWN_X = 5;
export const SPAWN_Y = 0;

export type Grid = number[][];

/** A read-only view of a grid — what `SimulationState.board` and `snapshotGrid` return. */
export type GridView = readonly (readonly number[])[];

export function createGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT }, () => new Array<number>(BOARD_WIDTH).fill(0));
}

export function rowOf(y: number): number {
  return y + HIDDEN_ROWS;
}

/**
 * Is a cell filled? The two hidden rows are NEVER stored: at lock, a cell that
 * falls in `y < 0` is dropped and the piece is truncated (§8). This is why the
 * hidden-row collision-indexing bug (§12.3) cannot occur here.
 */
export function isFilled(grid: GridView, x: number, y: number): boolean {
  if (y < 0 || y > BOTTOM_Y) return false;
  if (x < 0 || x >= BOARD_WIDTH) return false;
  return grid[rowOf(y)]![x] === 1;
}

/** `isPositionValid` (§1): all 4 destination cells must be in bounds and empty. */
export function isPositionValid(grid: GridView, orientationId: OrientationId, x: number, y: number): boolean {
  for (const c of cellsOfOrientation(orientationId)) {
    const cx = x + c.x;
    const cy = y + c.y;
    if (cx < 0 || cx >= BOARD_WIDTH) return false;
    if (cy < TOP_Y || cy > BOTTOM_Y) return false;
    if (isFilled(grid, cx, cy)) return false;
  }
  return true;
}

/** Stores a locked piece. Cells in the hidden rows (`y < 0`) are NOT stored. */
export function lockCells(grid: Grid, cells: readonly Cell[]): void {
  for (const c of cells) {
    if (c.y < 0) continue; // truncated: the hidden rows hold nothing
    if (c.x < 0 || c.x >= BOARD_WIDTH || c.y > BOTTOM_Y) {
      throw new Error(`lockCells: cell (${c.x},${c.y}) is out of bounds — an invalid piece must not be stored`);
    }
    grid[rowOf(c.y)]![c.x] = 1;
  }
}

/** The y values of the full VISIBLE rows (the hidden rows are always empty). */
export function findFullRows(grid: GridView): number[] {
  const full: number[] = [];
  for (let y = 0; y <= BOTTOM_Y; y++) {
    const row = grid[rowOf(y)]!;
    if (row.every((v) => v === 1)) full.push(y);
  }
  return full;
}

/** Removes the given rows and shifts everything above them down. */
export function clearRows(grid: Grid, rows: readonly number[]): void {
  const dropped = new Set(rows.map(rowOf));
  const kept = grid.filter((_, r) => !dropped.has(r));
  const next: Grid = [];
  for (let r = 0; r < BOARD_HEIGHT - kept.length; r++) {
    next.push(new Array<number>(BOARD_WIDTH).fill(0));
  }
  for (const row of kept) next.push(row);
  for (let r = 0; r < BOARD_HEIGHT; r++) grid[r] = next[r]!;
}

/** An immutable copy for `SimulationState.board`. */
export function snapshotGrid(grid: GridView): GridView {
  return Object.freeze(grid.map((row) => Object.freeze([...row])));
}

/** A mutable copy — used by the test-only placement planner. */
export function copyGrid(grid: GridView): Grid {
  return grid.map((row) => [...row]);
}
