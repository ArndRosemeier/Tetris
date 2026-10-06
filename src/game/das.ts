/**
 * NTSC DAS (§3, `[V]`). The ROM stores a counter that is SUBTRACTED from; the
 * observable behaviour is: a new press shifts one cell immediately, the first
 * auto-shift lands 16 frames later, and every auto-shift after that is 6 frames
 * apart. A blocked shift leaves the counter at 16, so it retries every frame.
 * PAL (12/4) is deliberately not modelled — this clone is NTSC.
 */
export const DAS_RESET_FRAMES = 16;

/** After a successful auto-shift the counter is set here: 16 - 6 = 10, i.e. the next shift is 6 frames later. */
export const DAS_CHARGE_AFTER_SHIFT = DAS_RESET_FRAMES - 6;

/** The number of frames between two consecutive auto-shifts. */
export const DAS_REPEAT_FRAMES = DAS_RESET_FRAMES - DAS_CHARGE_AFTER_SHIFT;
