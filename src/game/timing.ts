/**
 * THE one place the timing delays live.
 *
 * ⚠ CONFIDENCE. Every constant in this file is `[W]` — documented by tetris.wiki /
 * community research but NOT derived from the ROM disassembly. `docs/NES-MECHANICS.md`
 * §10 tags them that way and §13 lists them as uncertainties. They are implemented as
 * stated, behind named constants, so that a future ROM-verified slice can replace the
 * bodies of `areFramesForLock` / the `LINE_CLEAR_*` pair without touching the stepper.
 * Do NOT treat these numbers as ROM facts, and do not promote them to `[V]`.
 */

/**
 * `[W]` The opening entry delay: the FIRST piece hangs at its spawn for 96 frames
 * (~1.6 s). Pressing Down cancels it. Later pieces get ARE instead.
 */
export const ENTRY_DELAY_FRAMES = 96;

/**
 * `[W]` Soft drop: 1 cell per 2 frames, but the FIRST drop after Down is pressed
 * takes 3 frames. Gravity and soft drop never stack (at most one cell per frame).
 */
export const SOFT_DROP_FIRST_FRAMES = 3;
export const SOFT_DROP_FRAMES = 2;

/**
 * `[W]` ARE (the post-lock entry delay): 10 frames when the piece locked in the
 * bottom two visible rows, +2 frames for each group of 4 rows above that, capped
 * at 18. `lowestRow` is the lowest row (largest y) the locked piece occupied.
 */
export function areFramesForLock(lowestRow: number): number {
  if (lowestRow >= 18) return 10;
  if (lowestRow <= 1) return 18;
  return Math.min(18, 12 + 2 * Math.floor((17 - lowestRow) / 4));
}

/**
 * `[W]` The line-clear animation: 5 steps that each advance on a frame where the
 * global frame counter is a multiple of 4. It runs BEFORE the ARE. Because the lock
 * can land anywhere in that 4-frame cycle, the total line-clear delay is 17..20
 * frames — it is NOT a fixed number.
 */
export const LINE_CLEAR_STEPS = 5;
export const LINE_CLEAR_ANIMATION_PERIOD = 4;
