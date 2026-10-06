/**
 * Shared types for the pure simulation.
 *
 * Nothing under `src/game/` may touch the DOM, the canvas, `window`, a timer, the
 * wall clock or `Math.random` — the simulation is stepped explicitly and is fully
 * deterministic. See `docs/ARCHITECTURE.md` (the seam index).
 */

export type PieceId = 'T' | 'J' | 'Z' | 'O' | 'S' | 'L' | 'I';

/**
 * Orientation id 0..18, exactly the 19-entry NES table
 * (`docs/NES-MECHANICS.md` §1, MF / DIS `$8A9C`).
 */
export type OrientationId = number;

/** A cell. `y` may be -2 or -1: the two hidden rows above the visible field. */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

/**
 * What the caller is HOLDING this frame. "Newly pressed" is derived inside the
 * simulation from the previous frame's held set, so callers never pass edges —
 * that is what makes rotation-on-new-press and DAS correct.
 */
export interface Buttons {
  left: boolean;
  right: boolean;
  down: boolean;
  rotateCW: boolean;
  rotateCCW: boolean;
  up: boolean;
}

/**
 * `entry`     — the first piece hangs at its spawn for the opening delay (§10 `[W]`).
 * `playing`   — a piece is falling.
 * `lineClear` — a locked piece cleared rows; the NES line-clear animation delay (§10 `[W]`).
 * `are`       — the post-lock entry delay before the next piece spawns (§10 `[W]`).
 * `gameOver`  — a piece locked while its position was invalid (§8).
 */
export type Phase = 'entry' | 'playing' | 'lineClear' | 'are' | 'gameOver';

export interface ActivePiece {
  readonly piece: PieceId;
  readonly orientationId: OrientationId;
  readonly x: number;
  readonly y: number;
  /** The 4 occupied cells in ABSOLUTE board coordinates (y may be -2..-1). */
  readonly cells: readonly Cell[];
  /**
   * False when a cell overlaps a filled cell or is out of bounds. A piece may
   * spawn invalid — that is NOT itself a loss (§8); it is a loss only if it LOCKS
   * while still invalid.
   */
  readonly valid: boolean;
}

export interface PreviewPiece {
  readonly piece: PieceId;
  readonly orientationId: OrientationId;
  /** The 4 cells as (dx,dy) OFFSETS from the piece origin — the shape, not board coordinates. */
  readonly cells: readonly Cell[];
}

/** The horizontal auto-shift counter (§3). It is NOT reset on release, on spawn, or during ARE. */
export interface DasState {
  readonly direction: -1 | 0 | 1;
  readonly counter: number;
}

/**
 * The whole renderable simulation state. `createSimulation().state` builds a fresh
 * snapshot on every read, so a caller may hold on to one safely.
 */
export interface SimulationState {
  /**
   * Locked playfield. `BOARD_HEIGHT` rows (row 0 = y -2, the top hidden row;
   * row 21 = y 19, the bottom visible row) × `BOARD_WIDTH` columns of 0/1.
   */
  readonly board: readonly (readonly number[])[];
  readonly active: ActivePiece | null;
  /** Exactly one next piece (§9), generated ahead. Always present, even during ARE. */
  readonly next: PreviewPiece;
  readonly score: number;
  readonly lines: number;
  readonly level: number;
  readonly phase: Phase;
  readonly gameOver: boolean;
  /** Frames stepped since the round began (0 before the first `step`). */
  readonly frame: number;
  /** Frames remaining in the current delay phase (`entry` / `lineClear` / `are`); 0 otherwise. */
  readonly phaseFrames: number;
  /** The live 16-bit LFSR value (§2) — the piece is decided by the spawn frame. */
  readonly lfsr: number;
  /** The `$001A` spawn counter. It is NOT reset between games. */
  readonly spawnCount: number;
  /** The previous spawn's orientation id (`$0019`). */
  readonly spawnId: OrientationId;
  readonly das: DasState;
  /** Cells dropped by the CURRENT continuous soft drop; only these count at lock (§5). */
  readonly softDropCells: number;
  /** Total soft-drop points awarded so far (§5). */
  readonly softDropPoints: number;
  /** Total line count at which the next level-up fires (§6). */
  readonly linesAtNextLevel: number;
  /** The gravity seam's current value, frames per cell (§4). */
  readonly gravityFramesPerCell: number;
}
