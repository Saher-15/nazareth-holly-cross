// Pure rules of the photo grid and the lightbox (unit tested in tests/unit/places.test.ts).

export type Tile = 'feature' | 'tall' | 'normal';

/**
 * Shape of grid tile `i` of `total`: the first photo is a large feature tile, every sixth one
 * from the fourth is a tall tile (never among the last four, so the grid ends evenly).
 * Only one-column tiles span rows, so the grid never leaves holes in the middle.
 */
export function tileOf(i: number, total: number): Tile {
  if (i === 0) return 'feature';
  if (i % 6 === 3 && i < total - 4) return 'tall';
  return 'normal';
}

const TILE_SIZE: Record<Tile, readonly [columns: number, rows: number]> = {
  feature: [2, 2],
  tall: [1, 2],
  normal: [1, 1],
};

/**
 * How many columns the last tile spans so the grid ends on a full row, for a grid of `columns`
 * columns. Replays the CSS grid auto-placement of the tiles (row by row, never going back);
 * when the last row is left half empty right after the last tile, that tile widens to fill it.
 */
export function lastTileSpan(total: number, columns: number): number {
  if (total < 2) return 1;
  const taken = new Set<string>();
  const isFree = (row: number, col: number, w: number, h: number) => {
    if (col + w > columns) return false;
    for (let y = row; y < row + h; y += 1) for (let x = col; x < col + w; x += 1) if (taken.has(`${y},${x}`)) return false;
    return true;
  };
  let row = 0;
  let col = 0;
  let last = { row: 0, end: 0 };
  let bottom = 0;
  for (let i = 0; i < total; i += 1) {
    const [w0, h] = TILE_SIZE[tileOf(i, total)];
    const w = Math.min(w0, columns);
    while (!isFree(row, col, w, h)) {
      col += 1;
      if (col + w > columns) {
        col = 0;
        row += 1;
      }
    }
    for (let y = row; y < row + h; y += 1) for (let x = col; x < col + w; x += 1) taken.add(`${y},${x}`);
    last = { row, end: col + w };
    bottom = Math.max(bottom, row + h - 1);
    col += w;
  }
  if (last.row !== bottom) return 1;
  for (let x = last.end; x < columns; x += 1) if (taken.has(`${bottom},${x}`)) return 1;
  return 1 + columns - last.end;
}

/** Index after moving `delta` photos, wrapping around at both ends. */
export function stepIndex(index: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((index + delta) % total) + total) % total;
}

/** Minimum sideways finger travel (px) that counts as a swipe. */
export const SWIPE_MIN = 50;

/**
 * Photo step for a finished touch gesture: +1 next, -1 previous, 0 not a swipe.
 * Swiping towards the reading start shows the next photo, so right-to-left pages mirror it.
 */
export function swipeStep(dx: number, dy: number, rtl: boolean): -1 | 0 | 1 {
  if (Math.abs(dx) <= SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return 0;
  const towardsEnd = rtl ? dx > 0 : dx < 0;
  return towardsEnd ? 1 : -1;
}

/** Photo step for an arrow key (mirrored on right-to-left pages), 0 for any other key. */
export function keyStep(key: string, rtl: boolean): -1 | 0 | 1 {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return 0;
  const forward = key === (rtl ? 'ArrowLeft' : 'ArrowRight');
  return forward ? 1 : -1;
}
