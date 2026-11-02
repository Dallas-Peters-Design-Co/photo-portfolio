/**
 * Tiles coloured by hand on a mosaic, over whatever colour mode is chosen.
 *
 * Stored on the setting as `col.row#colour` entries, comma-joined (the
 * colour may carry transparency, #rrggbbaa; fully clear hides the tile). Kept
 * by column and row, so the paint stays put through gap, shape and colour
 * changes; changing how many tiles go across moves it with the grid.
 */

const ENTRY = /^(\d{1,4})\.(\d{1,4})(#[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i;

export const tileKey = (col: number, row: number) => `${col}.${row}`;

export const paintedOf = (value: unknown): Map<string, string> => {
  const out = new Map<string, string>();
  if (typeof value !== "string") {
    return out;
  }
  for (const part of value.split(",")) {
    const m = ENTRY.exec(part.trim());
    if (m) {
      out.set(tileKey(Number(m[1]), Number(m[2])), (m[3] ?? "").toLowerCase());
    }
  }
  return out;
};

export const paintedText = (painted: Map<string, string>): string =>
  [...painted].map(([key, colour]) => `${key}${colour}`).join(",");

/** The setting with one tile painted, or put back when `colour` is null. */
export const withTile = (
  value: unknown,
  col: number,
  row: number,
  colour: string | null
): string => {
  const painted = paintedOf(value);
  if (colour) {
    painted.set(tileKey(col, row), colour.toLowerCase());
  } else {
    painted.delete(tileKey(col, row));
  }
  return paintedText(painted);
};

/** Which tile a point on the picture (in its own pixels) falls in. */
export const tileAt = (
  x: number,
  y: number,
  width: number,
  height: number,
  columns: number
): { col: number; row: number } | null => {
  const cols = Math.max(2, columns || 48);
  const cell = width / cols;
  const rows = Math.max(1, Math.round(height / cell));
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  return col >= 0 && col < cols && row >= 0 && row < rows ? { col, row } : null;
};
