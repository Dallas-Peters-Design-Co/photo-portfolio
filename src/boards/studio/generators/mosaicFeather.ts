import type { StudioParam } from "../types";

/**
 * Feathering a mosaic's edges: tiles near where the picture ends (its
 * see-through parts, and the edge of the piece) thin out and fade, so the
 * shape dissolves into the ground instead of stopping hard.
 */
export const FEATHER_PARAM: StudioParam = {
  default: 0,
  key: "feather",
  label: "Feather the edges (tiles)",
  max: 12,
  min: 0,
  type: "range",
};

/** The tiles on an edge: see-through ones (0) and the piece's border (1). */
const edgesOf = (
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  dist: Float32Array
): number[] => {
  const queue: number[] = [];
  for (let at = 0; at < cols * rows; at += 1) {
    const c = at % cols;
    const r = (at - c) / cols;
    const border = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
    if ((data[at * 4 + 3] ?? 255) < 64) {
      dist[at] = 0;
      queue.push(at);
    } else if (border) {
      dist[at] = 1;
      queue.push(at);
    }
  }
  return queue;
};

/** The neighbours a tile's distance improves, each set one further on. */
const spread = (
  at: number,
  cols: number,
  rows: number,
  dist: Float32Array
): number[] => {
  const c = at % cols;
  const r = (at - c) / cols;
  const d = (dist[at] ?? 0) + 1;
  const out: number[] = [];
  for (const [dx, dy] of NEIGHBOURS) {
    const cc = c + dx;
    const rr = r + dy;
    const to = rr * cols + cc;
    if (cc >= 0 && rr >= 0 && cc < cols && rr < rows && d < (dist[to] ?? 0)) {
      dist[to] = d;
      out.push(to);
    }
  }
  return out;
};

const NEIGHBOURS = [-1, 0, 1]
  .flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const))
  .filter(([dx, dy]) => dx !== 0 || dy !== 0);

/**
 * How far into the picture each tile sits, in tiles, as 0–1 of the feather:
 * 1 is a whole tile; less is how likely it is to be drawn and how strongly.
 * Null when there's no feather.
 */
export const featherOf = (
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  feather: number
): Float32Array | null => {
  if (!(feather > 0)) {
    return null;
  }
  const n = cols * rows;
  const dist = new Float32Array(n).fill(Number.POSITIVE_INFINITY);
  let queue = edgesOf(data, cols, rows, dist);
  // Rings inwards from the edges, a tile at a time (diagonals included).
  while (queue.length > 0) {
    queue = queue.flatMap((at) => spread(at, cols, rows, dist));
  }
  const out = new Float32Array(n);
  for (let at = 0; at < n; at += 1) {
    out[at] = Math.min(1, (dist[at] ?? 0) / (feather + 1));
  }
  return out;
};

/** A steady 0–1 for a tile, so the same tiles drop out every redraw. */
export const tileNoise = (col: number, row: number): number => {
  const x = Math.sin(col * 127.1 + row * 311.7) * 43_758.5453;
  return x - Math.floor(x);
};

/** The colour at a share of its own opacity. */
export const faded = (colour: string, k: number): string => {
  if (k >= 1) {
    return colour;
  }
  const own =
    colour.length === 9 ? Number.parseInt(colour.slice(7, 9), 16) / 255 : 1;
  const a = Math.round(Math.max(0, Math.min(1, own * k)) * 255);
  return `${colour.slice(0, 7)}${a.toString(16).padStart(2, "0")}`;
};
