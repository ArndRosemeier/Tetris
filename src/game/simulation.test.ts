import { describe, expect, it } from 'vitest';

import { BOARD_WIDTH, BOTTOM_Y, rowOf } from './board';
import type { GridView } from './board';
import { framesPerCell } from './gravity';
import { advanceFrame, createRandomiser, pick } from './randomiser';
import { BASE_SCORES } from './scoring';
import { createSimulation, noButtons } from './simulation';
import type { Simulation } from './simulation';
import { playPiece, stepLfsrTimes } from './test-harness';
import type { Strategy } from './test-harness';
import { areFramesForLock } from './timing';
import type { Buttons, SimulationState } from './types';

const NONE = noButtons();

function hold(...keys: (keyof Buttons)[]): Buttons {
  const held = noButtons();
  for (const key of keys) held[key] = true;
  return held;
}

function stepIntoPlay(sim: Simulation): void {
  let guard = 0;
  while (sim.state.phase === 'entry' && guard++ < 200) sim.step(NONE);
}

/** Steps until the active piece's y changes; returns how many frames that took. */
function framesUntilDrop(sim: Simulation): number {
  const start = sim.state.active;
  if (!start) throw new Error('framesUntilDrop: no active piece');
  for (let frames = 1; frames <= 200; frames++) {
    sim.step(NONE);
    const now = sim.state.active;
    if (!now || now.y !== start.y) return frames;
  }
  throw new Error('framesUntilDrop: the piece did not drop within 200 frames');
}

/** Steps until the piece locks; returns how many frames that took. */
function framesUntilLock(sim: Simulation, heldFor: (frame: number) => Buttons): number {
  let frames = 0;
  while (sim.state.active && !sim.state.gameOver) {
    sim.step(heldFor(frames));
    frames += 1;
    if (frames > 400) throw new Error('framesUntilLock: the piece never locked');
  }
  return frames;
}

/** Holds Down until the flat I rests on the floor, releasing BEFORE the locking tick. */
function restFlatIOnTheFloor(sim: Simulation): void {
  for (let i = 0; i < 400 && sim.state.active?.y !== BOTTOM_Y; i++) sim.step(hold('down'));
  expect(sim.state.active?.y).toBe(BOTTOM_Y);
}

function boardAt(board: GridView, x: number, y: number): number {
  return board[rowOf(y)]![x]!;
}

function countFilled(board: GridView): number {
  return board.reduce((n, row) => n + row.filter((v) => v === 1).length, 0);
}

function playGame(sim: Simulation, strategy: Strategy, maxPieces: number, observe?: (s: SimulationState) => void): void {
  let pieces = 0;
  while (!sim.state.gameOver && pieces < maxPieces) {
    playPiece(sim, strategy, observe);
    pieces += 1;
  }
}

interface LockDelta {
  lines: number;
  score: number;
  softDrop: number;
  levelBefore: number;
  levelAfter: number;
}

/** Records what each lock added, by watching the state after every frame. */
function lockWatcher(): { events: LockDelta[]; observe: (s: SimulationState) => void } {
  const events: LockDelta[] = [];
  let prev: SimulationState | null = null;
  const observe = (s: SimulationState): void => {
    if (prev?.active && !s.active && !s.gameOver) {
      events.push({
        lines: s.lines - prev.lines,
        score: s.score - prev.score,
        softDrop: s.softDropPoints - prev.softDropPoints,
        levelBefore: prev.level,
        levelAfter: s.level,
      });
    }
    prev = s;
  };
  return { events, observe };
}

describe('rotation', () => {
  /**
   * PIN 1 — "a blocked rotation is refused: the piece keeps its position AND its
   * orientation." Watched red by adding a one-cell kick (see docs/TESTING.md).
   *
   * Seed 0x0500 makes the first piece the horizontal I (spawnTable[6]). Flat on the
   * floor it cannot rotate: orientation 17 would put a cell at y = 20.
   */
  it('a blocked rotation is refused: the piece keeps its position AND its orientation', () => {
    const sim = createSimulation({ seed: 0x0500 });
    expect(sim.state.active?.orientationId).toBe(18);
    restFlatIOnTheFloor(sim);
    const resting = sim.state.active!;

    sim.step(hold('rotateCW'));

    const after = sim.state.active!;
    expect(after.orientationId).toBe(18);
    expect(after.x).toBe(resting.x);
    expect(after.y).toBe(resting.y);
    expect(after.cells).toEqual(resting.cells);
  });

  it('a legal rotation in place changes the orientation without moving the piece', () => {
    const sim = createSimulation({ seed: 0x0500 });
    const before = sim.state.active!;
    sim.step(hold('rotateCW'));
    const after = sim.state.active!;
    expect(before.orientationId).toBe(18);
    expect(after.orientationId).toBe(17); // I toggles between its two orientations
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });

  it('rotation only fires on a NEW press — holding does not auto-repeat', () => {
    const sim = createSimulation({ seed: 0x0500 });
    sim.step(hold('rotateCW'));
    expect(sim.state.active?.orientationId).toBe(17);
    for (let i = 0; i < 30; i++) sim.step(hold('rotateCW'));
    expect(sim.state.active?.orientationId).toBe(17);
  });
});

describe('the LFSR seam inside the stepper', () => {
  /**
   * PIN 4 — "the simulation steps the LFSR exactly once per frame." Watched red by
   * stepping the LFSR inside the picker only, or by stepping it per input event.
   */
  it('steps the LFSR exactly once per frame, whatever the input or phase', () => {
    const idle = createSimulation({ seed: 0x8988 });
    for (let i = 0; i < 50; i++) idle.step(NONE);
    expect(idle.state.phase).toBe('entry'); // no spawn happened inside those 50 frames
    expect(idle.state.frame).toBe(50);
    expect(idle.state.lfsr).toBe(stepLfsrTimes(0x8988, 50));

    const busy = createSimulation({ seed: 0x8988 });
    for (let i = 0; i < 50; i++) busy.step(hold('left', 'rotateCW'));
    expect(busy.state.lfsr).toBe(stepLfsrTimes(0x8988, 50));
  });
});

describe('the integration model', () => {
  /**
   * PIN 5 — "the integration produces Vector D under the documented synthetic 48-frame
   * cadence."
   *
   * ⚠ DISPATCHER DESIGN DECISION, NOT ROM TRUTH. docs/NES-MECHANICS.md §11 supplies no
   * frame-exact multi-piece trace: it defines a model in which the LFSR is stepped once
   * per frame and a spawn happens every 48 frames. Real play has no such cadence (ARE is
   * 10..18 frames), so this pin drives the SAME two seams the frame loop uses —
   * `stepLfsr` per frame and `pick` at the spawn — with the model's cadence, and checks
   * the simulation's own opening two spawns against it.
   */
  it('reproduces Vector D: LFSR + picker under the 48-frame cadence (dispatcher model, not ROM truth)', () => {
    const sim = createSimulation({ seed: 0x8988 });
    expect(sim.state.active?.orientationId).toBe(8);
    expect(sim.state.next.orientationId).toBe(10);

    // The frame loop really does turn 48 frames into 48 steps of the same seam.
    for (let i = 0; i < 48; i++) sim.step(NONE);
    expect(sim.state.lfsr).toBe(stepLfsrTimes(0x8988, 48));

    let rng = createRandomiser(0x8988);
    const ids: number[] = [];
    const first = pick(rng);
    rng = first.state;
    ids.push(first.id);
    const second = pick(rng);
    rng = second.state;
    ids.push(second.id);
    for (let piece = 0; piece < 10; piece++) {
      for (let frame = 0; frame < 48; frame++) rng = advanceFrame(rng); // the frame seam itself
      const rolled = pick(rng);
      rng = rolled.state;
      ids.push(rolled.id);
    }

    expect(ids).toEqual([8, 10, 11, 18, 7, 11, 18, 2, 8, 7, 2, 11]);
    expect(rng.seed).toBe(0x7a3c);
    expect(rng.spawnCount).toBe(12);
    expect(rng.spawnID).toBe(11);
  });
});

describe('gravity on the stepper', () => {
  /**
   * PIN 6 (behavioural half) — the clamp is REAL, not just a table entry: at level 29
   * the piece moves one cell per frame; at level 0 one cell every 48.
   */
  it('drops one cell per frame at level 29 and one cell per 48 frames at level 0', () => {
    const fast = createSimulation({ seed: 0x0500, startingLevel: 29 });
    stepIntoPlay(fast);
    expect(framesUntilDrop(fast)).toBe(1);
    expect(framesUntilDrop(fast)).toBe(1);

    const slow = createSimulation({ seed: 0x0500, startingLevel: 0 });
    stepIntoPlay(slow);
    framesUntilDrop(slow); // the first cell of a piece carries the tail of the entry tick
    expect(framesUntilDrop(slow)).toBe(48);
    expect(framesUntilDrop(slow)).toBe(48);
  });
});

describe('lock behaviour', () => {
  /**
   * PIN 7 — "a piece locks only when a drop tick fails, and moving or rotating during
   * the resting window does not extend it." Watched red by adding a lock delay or a
   * move/rotate reset (see docs/TESTING.md).
   */
  it('locks only when a drop tick fails, and moving during the resting window does not extend it', () => {
    const quiet = createSimulation({ seed: 0x0500 });
    const busy = createSimulation({ seed: 0x0500 });
    restFlatIOnTheFloor(quiet);
    restFlatIOnTheFloor(busy);
    expect(quiet.state.active?.y).toBe(BOTTOM_Y);

    const quietFrames = framesUntilLock(quiet, () => NONE);
    const busyFrames = framesUntilLock(busy, (frame) => (frame % 2 === 0 ? hold('left') : hold('right')));

    expect(quietFrames).toBe(framesPerCell(0)); // 48: the failing gravity tick
    expect(busyFrames).toBe(quietFrames); // shifting every frame changed nothing
    expect(quiet.state.active).toBeNull();
    expect(quiet.state.phase).toBe('are');
  });

  it('locks on the failing tick even when a rotation is attempted in the resting window', () => {
    const quiet = createSimulation({ seed: 0x0500 });
    const busy = createSimulation({ seed: 0x0500 });
    restFlatIOnTheFloor(quiet);
    restFlatIOnTheFloor(busy);

    const quietFrames = framesUntilLock(quiet, () => NONE);
    // rotateCW is refused on the floor (pin 1), so alternate the edge to keep pressing
    const busyFrames = framesUntilLock(busy, (frame) => (frame % 2 === 0 ? hold('rotateCW') : NONE));

    expect(busyFrames).toBe(quietFrames);
  });

  it('soft-dropping into the stack locks on the soft-drop tick', () => {
    const sim = createSimulation({ seed: 0x0500 });
    const frames = framesUntilLock(sim, () => hold('down'));
    // 3 frames to the first drop, then 2 per cell down 19 cells, then one failing tick
    expect(frames).toBeLessThan(50);
    expect(sim.state.phase).toBe('are');
  });
});

describe('top-out', () => {
  /**
   * PIN 8 — "game over happens iff a locked piece was invalid, and a spawn that
   * overlaps is not itself a loss." Watched red by validating at spawn (see
   * docs/TESTING.md).
   */
  it('ends only when a piece LOCKS invalid; an overlapping spawn is not itself a loss', () => {
    const sim = createSimulation({ seed: 12 });
    let sawOverlappingSpawn = false;
    let overlapSurvived = false;
    let lockedInvalid = false;
    let prev: SimulationState | null = null;
    const observe = (s: SimulationState): void => {
      if (s.active && !s.active.valid) {
        sawOverlappingSpawn = true;
        if (!s.gameOver) overlapSurvived = true;
      }
      if (prev?.active && !s.active && s.gameOver) lockedInvalid = !prev.active.valid;
      prev = s;
    };

    playGame(sim, 'tower', 400, observe);

    expect(sawOverlappingSpawn).toBe(true);
    expect(overlapSurvived).toBe(true); // the overlapping spawn itself did not end the game
    expect(sim.state.gameOver).toBe(true);
    expect(sim.state.phase).toBe('gameOver');
    expect(lockedInvalid).toBe(true); // and the lock that DID end it was invalid
  });
});

describe('the two hidden rows', () => {
  /**
   * PIN 9 — "cells in the two hidden rows are not stored at lock." Watched red by
   * storing every cell of the locked piece (see docs/TESTING.md).
   */
  it('stores the visible cells of a locked piece and drops the hidden-row ones', () => {
    // Seed 12 + the tower planner reaches a lock with a cell above y=0 within ten
    // pieces (measured), which is the only way this rule can be exercised.
    const sim = createSimulation({ seed: 12 });
    let locks = 0;
    let locksWithHiddenCells = 0;
    let prev: SimulationState | null = null;
    const observe = (s: SimulationState): void => {
      if (prev?.active && !s.active && !s.gameOver) {
        locks += 1;
        const hidden = prev.active.cells.filter((c) => c.y < 0);
        const visible = prev.active.cells.filter((c) => c.y >= 0);
        if (hidden.length > 0) locksWithHiddenCells += 1;

        for (const cell of hidden) expect(boardAt(s.board, cell.x, cell.y)).toBe(0);
        for (let y = -2; y <= -1; y++) {
          for (let x = 0; x < BOARD_WIDTH; x++) expect(boardAt(s.board, x, y)).toBe(0);
        }
        // the piece is TRUNCATED: exactly its visible cells were added
        if (s.lines === prev.lines) {
          expect(countFilled(s.board)).toBe(countFilled(prev.board) + visible.length);
        }
      }
      prev = s;
    };

    playGame(sim, 'tower', 400, observe);

    expect(locks).toBeGreaterThan(3);
    expect(locksWithHiddenCells).toBeGreaterThan(0);
  });
});

describe('scoring', () => {
  /**
   * PIN 10 — "scoring uses the level AFTER the clear: a clear that levels up is scored
   * at the new level." Watched red by running the level-up check after the award
   * (see docs/TESTING.md).
   */
  it('scores every lock at the level AFTER the clear, including the one that levels up', () => {
    // Seed 2 is a seed this planner survives long enough to reach level 1 (10 lines).
    const sim = createSimulation({ seed: 2 });
    const { events, observe } = lockWatcher();

    let pieces = 0;
    while (sim.state.level < 1 && !sim.state.gameOver && pieces < 400) {
      playPiece(sim, 'flat', observe);
      pieces += 1;
    }

    expect(sim.state.gameOver).toBe(false); // the planner has to survive to level 1
    expect(sim.state.level).toBeGreaterThanOrEqual(1);
    expect(events.length).toBeGreaterThan(4);

    for (const event of events) {
      const baseAward = event.score - event.softDrop; // soft-drop points are a separate §5 rule
      expect(baseAward).toBe(BASE_SCORES[event.lines]! * (event.levelAfter + 1));
    }

    const levelUp = events.find((event) => event.levelAfter > event.levelBefore);
    expect(levelUp).toBeDefined();
    const upAward = levelUp!.score - levelUp!.softDrop;
    expect(upAward).toBe(BASE_SCORES[levelUp!.lines]! * (levelUp!.levelAfter + 1));
    expect(upAward).not.toBe(BASE_SCORES[levelUp!.lines]! * (levelUp!.levelBefore + 1));
  });

  it('awards the base score on a zero-line lock too, and keeps the score a plain integer', () => {
    const sim = createSimulation({ seed: 0x0500 });
    const before = sim.state.score;
    framesUntilLock(sim, () => hold('down'));
    expect(sim.state.score).toBeGreaterThan(before);
    expect(Number.isInteger(sim.state.score)).toBe(true);
  });
});

describe('DAS', () => {
  /**
   * PIN 11 — "DAS is 16 then 6, a blocked shift resets the counter to 16, and the
   * counter survives ARE and release." Watched red by changing DAS_RESET_FRAMES or the
   * post-shift charge (see docs/TESTING.md).
   */
  it('is 16 then 6, a blocked shift resets the counter to 16, and the counter survives ARE and release', () => {
    // Seed 0x0500: the first piece is the horizontal I at (5,0); the 96-frame entry
    // delay means no gravity interferes with the counter.
    const sim = createSimulation({ seed: 0x0500 });
    expect(sim.state.active?.orientationId).toBe(18);

    sim.step(hold('left')); // a tap: one cell immediately, counter charged from 0
    expect(sim.state.active?.x).toBe(4);
    expect(sim.state.das.counter).toBe(0);

    for (let i = 0; i < 15; i++) sim.step(hold('left'));
    expect(sim.state.active?.x).toBe(4);
    expect(sim.state.das.counter).toBe(15);

    sim.step(hold('left')); // frame 16: the first auto-shift, counter -> 10
    expect(sim.state.active?.x).toBe(3);
    expect(sim.state.das.counter).toBe(10);

    for (let i = 0; i < 5; i++) sim.step(hold('left'));
    expect(sim.state.active?.x).toBe(3);
    expect(sim.state.das.counter).toBe(15);
    sim.step(hold('left')); // frame 6 after the shift: the second auto-shift
    expect(sim.state.active?.x).toBe(2);
    expect(sim.state.das.counter).toBe(10);

    // x=2 is the wall for the horizontal I. Five frames of charge, then the blocked
    // attempt leaves the counter at 16 and it RETRIES every frame.
    for (let i = 0; i < 5; i++) {
      sim.step(hold('left'));
      expect(sim.state.active?.x).toBe(2);
      expect(sim.state.das.counter).toBe(11 + i);
    }
    for (let i = 0; i < 5; i++) {
      sim.step(hold('left'));
      expect(sim.state.active?.x).toBe(2);
      expect(sim.state.das.counter).toBe(16);
    }

    // release does NOT reset the counter, and does not advance it either
    sim.step(NONE);
    expect(sim.state.das.counter).toBe(16);
    for (let i = 0; i < 5; i++) sim.step(NONE);
    expect(sim.state.das.counter).toBe(16);

    // soft-drop to a lock: the counter is frozen (not advanced, not reset)
    let guard = 0;
    while (sim.state.active && !sim.state.gameOver && guard++ < 200) sim.step(hold('down'));
    expect(sim.state.active).toBeNull();
    const atLock = sim.state.das.counter;
    expect(atLock).toBe(16);

    // ...and it survives the whole ARE, even with Left held throughout
    let sawAreFrame = false;
    guard = 0;
    while (!sim.state.active && !sim.state.gameOver && guard++ < 100) {
      sim.step(hold('left'));
      sawAreFrame = true;
      expect(sim.state.das.counter).toBe(atLock);
    }
    expect(sawAreFrame).toBe(true);
    expect(sim.state.active).not.toBeNull();
    expect(sim.state.das.counter).toBe(atLock);
  });
});

describe('soft drop gating', () => {
  /**
   * PIN 12 — "horizontal shift is refused while Down is held." Watched red by letting
   * the DAS seam run during a soft drop (see docs/TESTING.md).
   */
  it('refuses the horizontal shift — tap and auto-shift alike — while Down is held', () => {
    const sim = createSimulation({ seed: 0x0500 });
    sim.step(hold('down'));
    expect(sim.state.phase).toBe('playing'); // Down also cancels the opening delay

    sim.step(hold('down', 'left')); // a NEW Left press, but Down is held
    expect(sim.state.active?.x).toBe(5);

    for (let i = 0; i < 20; i++) sim.step(hold('down', 'left')); // DAS never lands either
    expect(sim.state.active?.x).toBe(5);
    // Left also suppresses the soft drop, so the piece has not fallen at all
    expect(sim.state.active?.y).toBe(0);

    for (let i = 0; i < 10; i++) sim.step(hold('down')); // release Left: now it soft-drops
    expect(sim.state.active!.y).toBeGreaterThan(3);
    expect(sim.state.active?.x).toBe(5);

    sim.step(hold('down', 'right')); // a fresh Right press is refused too
    expect(sim.state.active?.x).toBe(5);
  });

  it('shifts again as soon as Down is released', () => {
    const sim = createSimulation({ seed: 0x0500 });
    sim.step(hold('down', 'left'));
    expect(sim.state.active?.x).toBe(5);
    sim.step(NONE); // release both
    sim.step(hold('left')); // a genuine new press
    expect(sim.state.active?.x).toBe(4);
  });

  it('takes 3 frames for the first Down drop, then 2 frames per cell', () => {
    const sim = createSimulation({ seed: 0x0500 });
    sim.step(hold('down')); // the soft-drop session starts here, without dropping
    expect(sim.state.active?.y).toBe(0);
    sim.step(hold('down'));
    expect(sim.state.active?.y).toBe(0);
    sim.step(hold('down'));
    expect(sim.state.active?.y).toBe(0);
    sim.step(hold('down')); // third frame after the press: the first drop
    expect(sim.state.active?.y).toBe(1);
    sim.step(hold('down'));
    expect(sim.state.active?.y).toBe(1);
    sim.step(hold('down'));
    expect(sim.state.active?.y).toBe(2);
  });

  it('never stacks gravity on top of a soft-drop tick (at most one cell per frame)', () => {
    for (const startingLevel of [0, 5, 29]) {
      const sim = createSimulation({ seed: 0x0500, startingLevel });
      let previousY = sim.state.active!.y;
      for (let frame = 0; frame < 60; frame++) {
        sim.step(hold('down'));
        const active = sim.state.active;
        if (!active) break;
        expect(active.y - previousY).toBeLessThanOrEqual(1);
        previousY = active.y;
      }
    }
  });

  it('cannot start or continue while Left, Right or Up is held, and Up cancels it', () => {
    const withLeft = createSimulation({ seed: 0x0500 });
    for (let i = 0; i < 10; i++) withLeft.step(hold('down', 'left'));
    expect(withLeft.state.active!.y).toBe(0); // Left suppressed the soft drop entirely

    const cancelled = createSimulation({ seed: 0x0500 });
    for (let i = 0; i < 6; i++) cancelled.step(hold('down'));
    const dropped = cancelled.state.active!.y;
    expect(dropped).toBeGreaterThan(0);
    cancelled.step(hold('down', 'up')); // Up cancels the session and re-arms the 3-frame start
    cancelled.step(hold('down'));
    cancelled.step(hold('down'));
    cancelled.step(hold('down'));
    expect(cancelled.state.active!.y).toBe(dropped);
  });
});

describe('the preview', () => {
  /**
   * PIN 13 — "the preview matches what spawns." Watched red by re-picking at spawn
   * instead of consuming the stored preview (see docs/TESTING.md).
   */
  it('always spawns exactly the piece the preview showed', () => {
    const sim = createSimulation({ seed: 2 });
    let preview: SimulationState['next'] | null = null;
    let spawns = 0;
    const observe = (s: SimulationState): void => {
      if (!s.active) {
        preview = s.next;
        return;
      }
      if (preview) {
        expect(s.active.orientationId).toBe(preview.orientationId);
        expect(s.active.piece).toBe(preview.piece);
        spawns += 1;
        preview = null;
      }
    };

    playGame(sim, 'flat', 60, observe);

    expect(spawns).toBeGreaterThan(20);
  });
});

describe('the documented [W] timings', () => {
  it('hangs the FIRST piece for the 96-frame opening entry delay, and Down cancels it', () => {
    const hanging = createSimulation({ seed: 0x8988 });
    for (let i = 0; i < 95; i++) hanging.step(NONE);
    expect(hanging.state.phase).toBe('entry');
    expect(hanging.state.active?.y).toBe(0);
    hanging.step(NONE);
    expect(hanging.state.phase).toBe('playing');

    const cancelled = createSimulation({ seed: 0x8988 });
    cancelled.step(hold('down'));
    expect(cancelled.state.phase).toBe('playing');
  });

  it('makes ARE 10..18 frames by lock height', () => {
    expect(areFramesForLock(19)).toBe(10);
    expect(areFramesForLock(18)).toBe(10);
    expect(areFramesForLock(17)).toBe(12);
    expect(areFramesForLock(14)).toBe(12);
    expect(areFramesForLock(13)).toBe(14);
    expect(areFramesForLock(10)).toBe(14);
    expect(areFramesForLock(9)).toBe(16);
    expect(areFramesForLock(2)).toBe(18);
    expect(areFramesForLock(0)).toBe(18);
    for (let row = -2; row <= 19; row++) {
      expect(areFramesForLock(row)).toBeGreaterThanOrEqual(10);
      expect(areFramesForLock(row)).toBeLessThanOrEqual(18);
    }
  });

  it('makes the line-clear delay 17..20 frames, depending on the lock’s frame phase', () => {
    const sim = createSimulation({ seed: 2 });
    const runs: number[] = [];
    let run = 0;
    const observe = (s: SimulationState): void => {
      if (s.phase === 'lineClear') run += 1;
      else if (run > 0) {
        runs.push(run);
        run = 0;
      }
    };

    playGame(sim, 'flat', 80, observe);

    expect(runs.length).toBeGreaterThan(2); // the planner really does clear rows
    for (const frames of runs) {
      expect(frames).toBeGreaterThanOrEqual(17);
      expect(frames).toBeLessThanOrEqual(20);
    }
  });
});

describe('soft-drop scoring', () => {
  it('awards one point per cell of the continuous soft drop that ends in the lock, and none once Down is released', () => {
    // Down all the way: the 19 cells of the fall are all soft-dropped, and the lock
    // tick is a soft-drop tick, so the award is 19 on top of base[0] * (0 + 1) = 0.
    const allTheWay = createSimulation({ seed: 0x0500 });
    framesUntilLock(allTheWay, () => hold('down'));
    expect(allTheWay.state.score).toBe(19);
    expect(allTheWay.state.softDropPoints).toBe(19);

    // Release Down before the piece locks: the counter is zeroed, so the lock scores
    // only the base award for zero lines.
    const released = createSimulation({ seed: 0x0500 });
    restFlatIOnTheFloor(released);
    framesUntilLock(released, () => NONE);
    expect(released.state.score).toBe(0);
    expect(released.state.softDropPoints).toBe(0);
  });
});

describe('restart', () => {
  it('resets the round but NOT the randomiser — $001A is not reset between games', () => {
    const sim = createSimulation({ seed: 0x8988 });
    for (let i = 0; i < 300; i++) sim.step(NONE);
    const carried = { seed: sim.state.lfsr, spawnCount: sim.state.spawnCount, spawnID: sim.state.spawnId };
    expect(carried.spawnCount).toBeGreaterThan(0);

    sim.restart();

    expect(sim.state.score).toBe(0);
    expect(sim.state.lines).toBe(0);
    expect(sim.state.level).toBe(0);
    expect(sim.state.gameOver).toBe(false);
    expect(sim.state.phase).toBe('entry');

    // §2: the LFSR and the spawn counter carry over into the new game, and the new
    // round opens with the same two picks it always does.
    const first = pick(carried);
    const second = pick(first.state);
    expect(sim.state.active?.orientationId).toBe(first.id);
    expect(sim.state.next.orientationId).toBe(second.id);
    expect(sim.state.lfsr).toBe(second.state.seed);
    expect(sim.state.spawnCount).toBe(carried.spawnCount + 2);
    expect(sim.state.spawnId).toBe(second.state.spawnID);
  });
});
