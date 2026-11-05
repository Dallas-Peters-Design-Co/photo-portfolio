import type { RenderContext, StudioValues } from "../types";
import { SAMPLES, type TypeMask } from "./flowText";

/**
 * Systems Flow from a picture rather than typed text: an object or the
 * selection from the frame, a logo, a file. Its shape becomes the grid's
 * coverage the way letters do: by what's see-through, or by its light or
 * dark parts for a picture that's opaque all over.
 */

export type ShapeBy = "alpha" | "dark" | "light";
export const shapeByOf = (v: StudioValues): ShapeBy =>
  v.shapeBy === "light" || v.shapeBy === "dark" ? v.shapeBy : "alpha";

const kept = new WeakMap<object, Map<string, TypeMask>>();

/** How much of each sample counts as the shape, 0 to 255. */
const amountOf = (data: Uint8ClampedArray, i: number, by: ShapeBy) => {
  const a = data[i + 3] ?? 0;
  if (by === "alpha") {
    return a;
  }
  const lum =
    ((data[i] ?? 0) * 0.299 +
      (data[i + 1] ?? 0) * 0.587 +
      (data[i + 2] ?? 0) * 0.114) /
    255;
  return (by === "light" ? lum : 1 - lum) * a;
};

const cover = (
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  by: ShapeBy
): Float32Array => {
  const W = cols * SAMPLES;
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        const at = ((r * SAMPLES + sy) * W + c * SAMPLES) * 4;
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          sum += amountOf(data, at + sx * 4, by);
        }
      }
      out[r * cols + c] = sum / (SAMPLES * SAMPLES * 255);
    }
  }
  return out;
};

/** The picture's shape on the grid, fitted inside it and centred. */
export const pictureMask = (
  v: StudioValues,
  image: NonNullable<RenderContext["image"]>,
  cols: number,
  rows: number
): TypeMask => {
  const by = shapeByOf(v);
  const key = [cols, rows, v.scale, by].join("|");
  const byImage = kept.get(image) ?? new Map<string, TypeMask>();
  kept.set(image, byImage);
  const had = byImage.get(key);
  if (had) {
    return had;
  }
  const W = cols * SAMPLES;
  const H = rows * SAMPLES;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const letter = new Int16Array(cols * rows).fill(-1);
  let out: TypeMask = { cover: new Float32Array(cols * rows), letter };
  if (g) {
    const iw = image.width || 1;
    const ih = image.height || 1;
    const size = (Math.max(30, Number(v.scale) || 100) / 100) * 0.94;
    const k = Math.min(W / iw, H / ih) * size;
    const dw = iw * k;
    const dh = ih * k;
    g.imageSmoothingQuality = "high";
    g.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const { data } = g.getImageData(0, 0, W, H);
    out = { cover: cover(data, cols, rows, by), letter };
  }
  if (byImage.size > 12) {
    byImage.clear();
  }
  byImage.set(key, out);
  return out;
};
