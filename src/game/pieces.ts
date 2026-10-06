import type { Cell, OrientationId, PieceId } from './types';

/**
 * The 19 NES orientations, as (dx,dy) OFFSETS from the piece origin.
 *
 * Transcribed verbatim from `docs/NES-MECHANICS.md` §1 (MF / DIS `$8A9C`). The
 * pivot is the piece origin (5,0) — the centre of the 5x5 grid the orientations are
 * encoded in, NOT the geometric centre — so rotating I/S/Z/J/L appears to shift the
 * cells. That is the baked offset table, not a kick: there is no kick table at all.
 */
const ORIENTATIONS: readonly (readonly Cell[])[] = [
  // T: ids 0..3 (spawn 2)
  [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }],
  [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }],
  // J: ids 4..7 (spawn 7)
  [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }],
  [{ x: -1, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
  [{ x: 0, y: -1 }, { x: 1, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }],
  [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  // Z: ids 8..9 (spawn 8)
  [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 1, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  // O: id 10 (spawn)
  [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }],
  // S: ids 11..12 (spawn 11)
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }],
  [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  // L: ids 13..16 (spawn 14)
  [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }],
  [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }],
  [{ x: 1, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
  // I: ids 17..18 (spawn 18)
  [{ x: 0, y: -2 }, { x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }],
  [{ x: -2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
];

/** Which piece each orientation id belongs to; index 0..18. */
const PIECE_OF_ORIENTATION: readonly PieceId[] = [
  'T', 'T', 'T', 'T',
  'J', 'J', 'J', 'J',
  'Z', 'Z',
  'O',
  'S', 'S',
  'L', 'L', 'L', 'L',
  'I', 'I',
];

/**
 * Clockwise successor of each orientation id (DIS table `$88EE`).
 * T 0->1->2->3->0, J 4->5->6->7->4, L 13->14->15->16->13, Z/S/I toggle, O fixed.
 * Z and S are not true mirrors — both derive from CCW rotation (§1).
 */
const CW_NEXT: readonly OrientationId[] = [
  1, 2, 3, 0,
  5, 6, 7, 4,
  9, 8,
  10,
  12, 11,
  14, 15, 16, 13,
  18, 17,
];

/** Counter-clockwise successor of each orientation id — the inverse of {@link CW_NEXT}. */
const CCW_NEXT: readonly OrientationId[] = CW_NEXT.map((_, id) => CW_NEXT.indexOf(id));

/** The orientation each piece spawns in (`docs/NES-MECHANICS.md` §1, §10). */
export const SPAWN_ORIENTATION: Readonly<Record<PieceId, OrientationId>> = {
  T: 2,
  J: 7,
  Z: 8,
  O: 10,
  S: 11,
  L: 14,
  I: 18,
};

export const ORIENTATION_COUNT = ORIENTATIONS.length;

export function isValidOrientationId(id: OrientationId): boolean {
  return Number.isInteger(id) && id >= 0 && id < ORIENTATIONS.length;
}

function assertOrientation(id: OrientationId, who: string): void {
  if (!isValidOrientationId(id)) {
    throw new Error(`${who}: orientation id must be an integer 0..18, got ${String(id)}`);
  }
}

/** The 4 offsets of an orientation. The returned cells must not be mutated. */
export function cellsOfOrientation(id: OrientationId): readonly Cell[] {
  assertOrientation(id, 'cellsOfOrientation');
  return ORIENTATIONS[id]!;
}

/** The 4 cells of an orientation placed at (x,y), in absolute board coordinates. */
export function cellsAt(id: OrientationId, x: number, y: number): Cell[] {
  return cellsOfOrientation(id).map((c) => ({ x: x + c.x, y: y + c.y }));
}

export function pieceOfOrientation(id: OrientationId): PieceId {
  assertOrientation(id, 'pieceOfOrientation');
  return PIECE_OF_ORIENTATION[id]!;
}

/** The orientation reached by one rotation. `direction` is +1 for CW, -1 for CCW. */
export function rotateOrientation(id: OrientationId, direction: 1 | -1): OrientationId {
  assertOrientation(id, 'rotateOrientation');
  if (direction !== 1 && direction !== -1) {
    throw new Error(`rotateOrientation: direction must be 1 or -1, got ${String(direction)}`);
  }
  return (direction === 1 ? CW_NEXT[id]! : CCW_NEXT[id]!);
}
