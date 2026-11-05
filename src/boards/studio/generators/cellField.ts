import { rng } from "../rng";
import type { RenderContext } from "../types";

/**
 * Values over a grid of cells, for the cell tools (Dither Grid, Grid Boxes):
 * a picture sampled cell by cell, or a soft generated field.
 */

type Picture = NonNullable<RenderContext["image"]>;
const samples = new WeakMap<object, Map<string, Uint8ClampedArray>>();

/** The picture fitted to cover the piece, one RGBA sample per cell. */
export const coverSample = (
  image: Picture,
  cols: number,
  rows: number,
  ctx: RenderContext
): Uint8ClampedArray => {
  const key = `${cols}x${rows}@${ctx.width}x${ctx.height}`;
  const byImage = samples.get(image) ?? new Map<string, Uint8ClampedArray>();
  samples.set(image, byImage);
  const had = byImage.get(key);
  if (had) {
    return had;
  }
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  let data = new Uint8ClampedArray(cols * rows * 4);
  if (g) {
    const s = Math.max(ctx.width / image.width, ctx.height / image.height);
    const sw = ctx.width / s;
    const sh = ctx.height / s;
    g.imageSmoothingQuality = "high";
    g.drawImage(
      image,
      (image.width - sw) / 2,
      (image.height - sh) / 2,
      sw,
      sh,
      0,
      0,
      cols,
      rows
    );
    ({ data } = g.getImageData(0, 0, cols, rows));
  }
  if (byImage.size > 16) {
    byImage.clear();
  }
  byImage.set(key, data);
  return data;
};

/** A sample's brightness, 0 to 1. */
export const lumAt = (data: Uint8ClampedArray, cell: number): number =>
  ((data[cell * 4] ?? 0) * 0.299 +
    (data[cell * 4 + 1] ?? 0) * 0.587 +
    (data[cell * 4 + 2] ?? 0) * 0.114) /
  255;

/**
 * Soft clouds over the grid, 0 to 1: a few octaves of smoothed random
 * values. `size` is how big the clouds are, as a share of the width.
 */
export const clouds = (
  cols: number,
  rows: number,
  seed: number,
  size: number
): Float32Array => {
  const out = new Float32Array(cols * rows);
  const rand = rng(seed);
  let amp = 1;
  let total = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    const step = Math.max(1, (cols * size) / 2 ** octave);
    const gw = Math.ceil(cols / step) + 2;
    const gh = Math.ceil(rows / step) + 2;
    const lattice = Float32Array.from({ length: gw * gh }, rand);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = c / step;
        const y = r / step;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const tx = smooth(x - x0);
        const ty = smooth(y - y0);
        const at = (xx: number, yy: number) => lattice[yy * gw + xx] ?? 0;
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const bottom =
          at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        out[r * cols + c] =
          (out[r * cols + c] ?? 0) + (top + (bottom - top) * ty) * amp;
      }
    }
    total += amp;
    amp /= 2;
  }
  return out.map((v) => v / total);
};

const smooth = (t: number) => t * t * (3 - 2 * t);

/** A number setting, or its default when it isn't one (0 is kept). */
export const numOr = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return value === undefined ||
    value === null ||
    value === "" ||
    !Number.isFinite(n)
    ? fallback
    : n;
};
