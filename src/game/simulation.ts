import {
  SPAWN_X,
  SPAWN_Y,
  clearRows,
  createGrid,
  findFullRows,
  isPositionValid,
  lockCells,
  snapshotGrid,
} from './board';
import type { Grid } from './board';
import { DAS_CHARGE_AFTER_SHIFT, DAS_RESET_FRAMES } from './das';
import { framesPerCell } from './gravity';
import { LINES_PER_LEVEL, firstLevelUpLines } from './level';
import { cellsAt, pieceOfOrientation, rotateOrientation } from './pieces';
import { DEFAULT_SEED, advanceFrame, createRandomiser, pick } from './randomiser';
import type { RandomiserState } from './randomiser';
import { lockBaseScore } from './scoring';
import {
  ENTRY_DELAY_FRAMES,
  LINE_CLEAR_ANIMATION_PERIOD,
  LINE_CLEAR_STEPS,
  SOFT_DROP_FIRST_FRAMES,
  SOFT_DROP_FRAMES,
  areFramesForLock,
} from './timing';
import type { Buttons, Cell, OrientationId, Phase, SimulationState } from './types';

export type { SimulationState } from './types';

export interface SimulationOptions {
  /** LFSR power-on seed. The ROM's is `0x8988`. */
  seed?: number;
  /**
   * A-Type starting level (default 0). The brief fixes this at 0 for the game, since
   * level select is out of scope — it is exposed so the gravity/scoring rules of a
   * later level are reachable without scripting 100+ lines of play.
   */
  startingLevel?: number;
}

/**
 * THE seam: the pure, frame-stepped NES simulation. One `step()` is exactly one
 * 60.0988 Hz frame. Nothing here reads the DOM, the clock or `Math.random`.
 */
export interface Simulation {
  /** Advances EXACTLY ONE frame. */
  step(held: Buttons): void;
  readonly state: Readonly<SimulationState>;
  restart(): void;
}

export function noButtons(): Buttons {
  return { left: false, right: false, down: false, rotateCW: false, rotateCCW: false, up: false };
}

interface FallingPiece {
  orientationId: OrientationId;
  x: number;
  y: number;
}

export function createSimulation(opts: SimulationOptions = {}): Simulation {
  const seed = opts.seed ?? DEFAULT_SEED;
  const startingLevel = opts.startingLevel ?? 0;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff) {
    throw new Error(`createSimulation: seed must be a 16-bit integer, got ${String(seed)}`);
  }
  if (!Number.isInteger(startingLevel) || startingLevel < 0) {
    throw new Error(`createSimulation: startingLevel must be a non-negative integer, got ${String(startingLevel)}`);
  }

  let rng: RandomiserState;
  let grid: Grid = createGrid();
  let frame = 0;
  let phase: Phase = 'entry';
  let phaseFrames = 0;
  let active: FallingPiece | null = null;
  let nextId: OrientationId = 0;
  let score = 0;
  let lines = 0;
  let level = startingLevel;
  let linesAtNextLevel = 0;
  let gameOver = false;
  let gravityTimer = 0;
  let dasCounter = 0;
  let dasDirection: -1 | 0 | 1 = 0;
  let softDropActive = false;
  let softDropTimer = 0;
  let softDropCells = 0;
  let softDropPoints = 0;
  let lineClearSteps = 0;
  let pendingAreFrames = 0;
  let prevHeld: Buttons = noButtons();

  /** Resets the round's own state. The RNG is deliberately NOT reset — see `restart`. */
  function resetRound(): void {
    grid = createGrid();
    frame = 0;
    score = 0;
    lines = 0;
    level = startingLevel;
    linesAtNextLevel = firstLevelUpLines(startingLevel);
    gameOver = false;
    active = null;
    gravityTimer = 0;
    dasCounter = 0;
    dasDirection = 0;
    softDropActive = false;
    softDropTimer = 0;
    softDropCells = 0;
    softDropPoints = 0;
    lineClearSteps = 0;
    pendingAreFrames = 0;
    prevHeld = noButtons();
  }

  /** §9: `current := pick(); next := pick()` — the stored preview is consumed verbatim at spawn. */
  function beginRound(): void {
    const first = pick(rng);
    rng = first.state;
    const second = pick(rng);
    rng = second.state;
    active = { orientationId: first.id, x: SPAWN_X, y: SPAWN_Y };
    nextId = second.id;
    phase = 'entry';
    phaseFrames = ENTRY_DELAY_FRAMES;
  }

  /** Consumes the preview. The DAS counter is deliberately NOT reset here (§3, pin 11). */
  function spawnNext(): void {
    const id = nextId;
    const rolled = pick(rng);
    rng = rolled.state;
    nextId = rolled.id;
    active = { orientationId: id, x: SPAWN_X, y: SPAWN_Y };
    phase = 'playing';
    gravityTimer = 0;
    softDropActive = false;
    softDropTimer = 0;
    softDropCells = 0;
  }

  function tryMoveDown(): boolean {
    if (!active) throw new Error('simulation: tryMoveDown with no active piece');
    if (isPositionValid(grid, active.orientationId, active.x, active.y + 1)) {
      active.y += 1;
      return true;
    }
    return false;
  }

  /**
   * §1: validate the new orientation AT THE SAME (x,y). If it is invalid the old
   * orientation is restored. There is no kick, no nudge and no offset table — this
   * refusal IS the NES behaviour.
   */
  function tryRotate(direction: 1 | -1): void {
    if (!active) return;
    const rotated = rotateOrientation(active.orientationId, direction);
    if (rotated === active.orientationId) return; // O is fixed
    if (isPositionValid(grid, rotated, active.x, active.y)) {
      active.orientationId = rotated;
    }
  }

  function tryShift(direction: -1 | 1): boolean {
    if (!active) throw new Error('simulation: tryShift with no active piece');
    const nx = active.x + direction;
    if (isPositionValid(grid, active.orientationId, nx, active.y)) {
      active.x = nx;
      return true;
    }
    return false;
  }

  /** Rotation on NEW presses, horizontal shift on new presses + DAS (§1, §3, §10). */
  function handleInput(held: Buttons, pressed: Buttons): void {
    if (!active) return;

    if (pressed.rotateCW) tryRotate(1);
    else if (pressed.rotateCCW) tryRotate(-1);

    // §10: you cannot shift horizontally while Down is held — the whole horizontal
    // routine is dead, so the DAS counter neither charges nor resets in those frames.
    if (held.down) return;

    const direction: -1 | 0 | 1 = held.right ? 1 : held.left ? -1 : 0;

    if (pressed.left || pressed.right) {
      // A tap resets the counter to 0; a BLOCKED tap sets it straight to 16 (§3).
      dasCounter = 0;
      dasDirection = direction;
      if (direction !== 0 && !tryShift(direction)) dasCounter = DAS_RESET_FRAMES;
      return;
    }

    if (direction === 0) return; // released: the counter keeps its value, it is not reset

    dasDirection = direction;
    dasCounter += 1;
    if (dasCounter >= DAS_RESET_FRAMES) {
      // Success -> charge to 10 (the next auto-shift is 6 frames later).
      // Blocked -> stay at 16, so it retries on every subsequent frame.
      dasCounter = tryShift(direction) ? DAS_CHARGE_AFTER_SHIFT : DAS_RESET_FRAMES;
    }
  }

  /** Soft drop (§10) then gravity (§4). At most ONE cell per frame, never stacked. */
  function advanceFall(held: Buttons): void {
    if (!active) return;

    // Soft drop cannot start or continue while Left, Right or Up is held; Up cancels it.
    const wantsSoftDrop = held.down && !held.left && !held.right && !held.up;
    const startedThisFrame = wantsSoftDrop && !softDropActive;

    if (!wantsSoftDrop) {
      if (softDropActive) softDropActive = false;
      softDropTimer = 0;
      softDropCells = 0;
    } else if (startedThisFrame) {
      softDropActive = true;
      softDropCells = 0;
      softDropTimer = SOFT_DROP_FIRST_FRAMES;
    }

    if (softDropActive && !startedThisFrame) {
      softDropTimer -= 1;
      if (softDropTimer <= 0) {
        if (tryMoveDown()) {
          softDropCells += 1;
          softDropTimer = SOFT_DROP_FRAMES;
          gravityTimer = 0; // a successful drop resets the fall timer (§7)
          return;
        }
        lockPiece(true);
        return;
      }
    }

    gravityTimer += 1;
    if (gravityTimer >= framesPerCell(level)) {
      if (tryMoveDown()) {
        gravityTimer = 0; // a successful drop resets the fall timer (§7)
      } else {
        lockPiece(false);
      }
    }
  }

  /**
   * §7/§8. A piece locks ONLY because a drop tick (gravity or soft drop) failed.
   * There is no lock-delay timer: the window between the last successful drop and
   * this failing tick is exactly `framesPerCell(level)`, and moving or rotating
   * during it neither locks early nor extends it.
   */
  function lockPiece(viaSoftDropTick: boolean): void {
    if (!active) throw new Error('simulation: lockPiece with no active piece');
    const { orientationId, x, y } = active;

    // §8: game over IFF a locked piece's position is invalid. A spawn overlap that is
    // never corrected ends here; the overlap by itself is not a loss.
    if (!isPositionValid(grid, orientationId, x, y)) {
      gameOver = true;
      phase = 'gameOver';
      phaseFrames = 0;
      active = null;
      softDropActive = false;
      softDropTimer = 0;
      softDropCells = 0;
      return;
    }

    const cells = cellsAt(orientationId, x, y);
    lockCells(grid, cells); // hidden-row cells are dropped: the piece is truncated

    const full = findFullRows(grid);
    if (full.length > 0) clearRows(grid, full);
    const cleared = full.length;
    lines += cleared;

    // §5/§6: the level-up check runs FIRST, so the score uses the level AFTER the clear.
    while (lines >= linesAtNextLevel) {
      level += 1;
      linesAtNextLevel += LINES_PER_LEVEL;
    }
    score += lockBaseScore(cleared, level);

    // §5 soft drop: only the current continuous soft drop counts, and only when the
    // drop tick that ended it was a soft-drop tick.
    if (viaSoftDropTick && softDropCells > 0) {
      score += softDropCells;
      softDropPoints += softDropCells;
    }

    const lowestRow = Math.max(...cells.map((c) => c.y));
    active = null;
    gravityTimer = 0;
    softDropActive = false;
    softDropTimer = 0;
    softDropCells = 0;

    if (cleared > 0) {
      phase = 'lineClear';
      lineClearSteps = LINE_CLEAR_STEPS;
      pendingAreFrames = areFramesForLock(lowestRow);
    } else {
      phase = 'are';
      phaseFrames = areFramesForLock(lowestRow);
    }
  }

  function step(held: Buttons): void {
    const pressed: Buttons = {
      left: held.left && !prevHeld.left,
      right: held.right && !prevHeld.right,
      down: held.down && !prevHeld.down,
      rotateCW: held.rotateCW && !prevHeld.rotateCW,
      rotateCCW: held.rotateCCW && !prevHeld.rotateCCW,
      up: held.up && !prevHeld.up,
    };
    prevHeld = { ...held };

    const frameIndex = frame;
    frame += 1;
    // §2/§11: exactly ONE LFSR step per frame, whatever the phase — including the
    // entry delay, ARE, the line-clear animation and the game-over screen.
    rng = advanceFrame(rng);

    switch (phase) {
      case 'entry': {
        // `[W]` §10: the FIRST piece hangs at its spawn for ENTRY_DELAY_FRAMES. It is
        // still controllable — horizontal shifts and rotations run normally; only
        // gravity waits. Down cancels the delay and starts the soft drop in the same frame.
        handleInput(held, pressed);
        const entryOver = pressed.down || phaseFrames - 1 <= 0;
        if (entryOver) {
          phase = 'playing';
          phaseFrames = 0;
          gravityTimer = 0;
          advanceFall(held);
        } else {
          phaseFrames -= 1;
        }
        break;
      }
      case 'playing': {
        handleInput(held, pressed);
        advanceFall(held);
        break;
      }
      case 'lineClear': {
        // §10 `[W]`: 5 animation steps, each advancing on a frame where the global
        // frame counter is a multiple of 4 -> a 17..20 frame delay.
        if (frameIndex % LINE_CLEAR_ANIMATION_PERIOD === 0) {
          lineClearSteps -= 1;
          if (lineClearSteps <= 0) {
            phase = 'are';
            phaseFrames = pendingAreFrames;
          }
        }
        break;
      }
      case 'are': {
        phaseFrames -= 1;
        if (phaseFrames <= 0) spawnNext();
        break;
      }
      case 'gameOver': {
        break;
      }
    }
  }

  function buildActive(): SimulationState['active'] {
    if (!active) return null;
    const cells: readonly Cell[] = cellsAt(active.orientationId, active.x, active.y);
    return Object.freeze({
      piece: pieceOfOrientation(active.orientationId),
      orientationId: active.orientationId,
      x: active.x,
      y: active.y,
      cells,
      valid: isPositionValid(grid, active.orientationId, active.x, active.y),
    });
  }

  function readState(): Readonly<SimulationState> {
    const snapshot: SimulationState = {
      board: snapshotGrid(grid),
      active: buildActive(),
      next: Object.freeze({
        piece: pieceOfOrientation(nextId),
        orientationId: nextId,
        cells: cellsAt(nextId, 0, 0),
      }),
      score,
      lines,
      level,
      phase,
      gameOver,
      frame,
      phaseFrames,
      lfsr: rng.seed,
      spawnCount: rng.spawnCount,
      spawnId: rng.spawnID,
      das: Object.freeze({ direction: dasDirection, counter: dasCounter }),
      softDropCells,
      softDropPoints,
      linesAtNextLevel,
      gravityFramesPerCell: framesPerCell(level),
    };
    return Object.freeze(snapshot);
  }

  rng = createRandomiser(seed);
  resetRound();
  beginRound();

  return {
    step,
    get state(): Readonly<SimulationState> {
      return readState();
    },
    /**
     * Starts a new round. The board, score, lines, level and timers reset; the LFSR,
     * `spawnCount` and `spawnID` deliberately do NOT — §2 records `$001A` as "NOT reset
     * between games", so the second game's sequence continues where the first ended.
     */
    restart(): void {
      resetRound();
      beginRound();
    },
  };
}
