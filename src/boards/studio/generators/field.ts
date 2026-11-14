import { rng } from "../rng";
import type { RenderContext, StudioParam, StudioValues } from "../types";
import { clouds, coverSample, numOr } from "./cellField";
import { shapeByOf } from "./flowPicture";
import { FONTS, maskOf } from "./flowText";

/**
 * What shapes a pattern: a value from 0 to 1 over the piece, from typed
 * text, a picture (an object, the selection, a file), soft noise, waves
 * (crossing sine waves, the Durves look), a straight gradient or a radial
 * one. Shared by Halftone, Line Waves and Iso Blocks.
 *
 * Two settings no control shows move the field for video (io/hyperframes):
 * `fieldDrift`, how much (0 still), and `fieldPhase`, where in the loop (0
 * to 1). Every source comes back to where it started at phase 1, and at
 * phase 0 the field is exactly the picture as made.
 */
export type FieldSource =
  | "blobs"
  | "gradient"
  | "noise"
  | "picture"
  | "radial"
  | "text"
  | "waves";

const LABELS: Record<FieldSource, string> = {
  blobs: "Soft blobs",
  gradient: "A gradient",
  noise: "Soft noise",
  picture: "A picture (an object, the selection, a file)",
  radial: "From the centre out",
  text: "Text",
  waves: "Waves",
};

const isText = (v: StudioValues) => v.source === "text";
const isPicture = (v: StudioValues) => v.source === "picture";

/** The settings for choosing and shaping the source. */
export const fieldParams = (
  sources: FieldSource[],
  first: FieldSource,
  text = "ASSETS"
): StudioParam[] => [
  {
    default: first,
    key: "source",
    label: "Shaped by",
    options: sources.map((value) => ({ label: LABELS[value], value })),
    type: "select",
  },
  { key: "image", label: "Picture", type: "image", when: isPicture },
  {
    default: "dark",
    key: "shapeBy",
    label: "Strongest where it's",
    options: [
      { label: "Dark", value: "dark" },
      { label: "Light", value: "light" },
      { label: "Not see-through", value: "alpha" },
    ],
    type: "select",
    when: isPicture,
  },
  {
    default: text,
    key: "text",
    label: "Text",
    multiline: true,
    type: "text",
    when: isText,
  },
  {
    default: "DM Sans",
    key: "font",
    label: "Font",
    options: FONTS.map((f) => ({ label: f, value: f })),
    type: "select",
    when: isText,
  },
  {
    default: "800",
    key: "weight",
    label: "Weight",
    options: [
      { label: "Regular", value: "400" },
      { label: "Bold", value: "700" },
      { label: "Extra bold", value: "800" },
    ],
    type: "select",
    when: isText,
  },
  {
    default: 100,
    key: "scale",
    label: "Text size",
    max: 140,
    min: 30,
    type: "range",
    when: isText,
  },
  {
    default: 4,
    key: "waveCount",
    label: "Waves",
    max: 16,
    min: 0,
    type: "range",
    when: (v) => v.source === "waves",
  },
  {
    default: 30,
    key: "waveAmp",
    label: "Amplitude",
    max: 100,
    min: 0,
    type: "range",
    when: (v) => v.source === "waves",
  },
  {
    default: 3,
    key: "waveFreq",
    label: "Frequency",
    max: 20,
    min: 1,
    step: 0.5,
    type: "range",
    when: (v) => v.source === "waves",
  },
  {
    default: 3,
    key: "blobCount",
    label: "Blobs",
    max: 12,
    min: 1,
    type: "range",
    when: (v) => v.source === "blobs",
  },
  {
    default: 35,
    key: "blobSize",
    label: "Blob size",
    max: 100,
    min: 5,
    type: "range",
    when: (v) => v.source === "blobs",
  },
  {
    default: 30,
    key: "noiseSize",
    label: "Noise size",
    max: 100,
    min: 5,
    type: "range",
    when: (v) => v.source === "noise",
  },
  {
    default: 90,
    key: "fieldAngle",
    label: "Direction",
    max: 360,
    min: 0,
    step: 5,
    type: "range",
    when: (v) => v.source === "gradient" || v.source === "waves",
  },
  {
    default: 50,
    key: "fieldX",
    label: "Centre across (%)",
    max: 150,
    min: -50,
    type: "range",
    when: (v) => v.source === "radial",
  },
  {
    default: 50,
    key: "fieldY",
    label: "Centre down (%)",
    max: 150,
    min: -50,
    type: "range",
    when: (v) => v.source === "radial",
  },
  {
    default: 100,
    key: "contrast",
    label: "Contrast",
    max: 250,
    min: 30,
    type: "range",
  },
  { default: false, key: "invert", label: "Invert", type: "checkbox" },
];

const TAU = Math.PI * 2;

const geometric = (
  v: StudioValues,
  cols: number,
  rows: number,
  aspect: number
): Float32Array => {
  const out = new Float32Array(cols * rows);
  const a = (numOr(v.fieldAngle, 90) * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u = (c + 0.5) / cols;
      const w = (r + 0.5) / rows;
      out[r * cols + c] = geometricAt(v, u, w, dx, dy, aspect);
    }
  }
  return out;
};

const geometricAt = (
  v: StudioValues,
  u: number,
  w: number,
  dx: number,
  dy: number,
  aspect: number
): number => {
  const [ox, oy, shift] = driftOf(v);
  if (v.source === "radial") {
    // The centre traces a figure of eight through where it was set.
    const cx = numOr(v.fieldX, 50) / 100 + ox;
    const cy = numOr(v.fieldY, 50) / 100 + oy;
    const d =
      Math.hypot((u - cx) * aspect, w - cy) / Math.hypot(aspect / 2, 0.5);
    return 1 - Math.min(1, d);
  }
  // Along the direction, 0 to 1 across the piece.
  const along =
    0.5 +
    ((u - 0.5) * dx * aspect + (w - 0.5) * dy) /
      (Math.abs(dx) * aspect + Math.abs(dy) || 1);
  if (v.source === "gradient") {
    return along + oy;
  }
  // Waves: bands along the direction, bent by a sine across it (Durves).
  const across = 0.5 + ((u - 0.5) * -dy * aspect + (w - 0.5) * dx);
  const amp = numOr(v.waveAmp, 30) / 100;
  const bend = amp * Math.sin(TAU * numOr(v.waveCount, 4) * across * 0.25);
  return (
    0.5 + 0.5 * Math.sin(TAU * (numOr(v.waveFreq, 3) * along + bend + shift))
  );
};

/**
 * The drift at this phase: a figure-of-eight offset (radial centre, a
 * gradient's slide) and a whole number of wave cycles travelled, all zero
 * at the start and end of the loop.
 */
const driftOf = (v: StudioValues): [number, number, number] => {
  const amount = numOr(v.fieldDrift, 0);
  if (amount <= 0) {
    return [0, 0, 0];
  }
  const p = numOr(v.fieldPhase, 0);
  const r = 0.12 * amount;
  return [
    r * Math.sin(TAU * p),
    (r / 2) * Math.sin(2 * TAU * p),
    Math.max(1, Math.round(amount)) * p,
  ];
};

/**
 * A few soft round glows, placed by the seed, adding up where they meet:
 * the low-resolution heat-map look.
 */
const blobs = (
  v: StudioValues,
  cols: number,
  rows: number,
  aspect: number
): Float32Array => {
  const rand = rng(Number(v.seed) || 1);
  const n = Math.max(1, Math.round(numOr(v.blobCount, 3)));
  const size = Math.max(0.05, numOr(v.blobSize, 35) / 100);
  const spots = Array.from({ length: n }, () => ({
    r: size * (0.6 + rand() * 0.8),
    w: 0.6 + rand() * 0.4,
    x: rand() * aspect,
    y: rand(),
  }));
  // Drifting, each glow circles near where the seed put it, its own way
  // round, and is back there at the end of the loop.
  const amount = numOr(v.fieldDrift, 0);
  if (amount > 0) {
    const p = numOr(v.fieldPhase, 0);
    spots.forEach((s, i) => {
      const at = (i * 0.618) % 1;
      const way = i % 2 === 0 ? 1 : -1;
      const reach = 0.25 * size * amount;
      s.x += reach * (Math.sin(TAU * (way * p + at)) - Math.sin(TAU * at));
      s.y += reach * (Math.cos(TAU * (way * p + at)) - Math.cos(TAU * at));
    });
  }
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = ((c + 0.5) / cols) * aspect;
      const y = (r + 0.5) / rows;
      let sum = 0;
      for (const s of spots) {
        const d2 = ((x - s.x) ** 2 + (y - s.y) ** 2) / (s.r * s.r);
        sum += s.w * Math.exp(-d2 * 2);
      }
      out[r * cols + c] = Math.min(1, sum);
    }
  }
  return out;
};

/** A picture's amount per cell, by its dark, light or opaque parts. */
const pictured = (
  v: StudioValues,
  ctx: RenderContext,
  cols: number,
  rows: number
): Float32Array | null => {
  if (!ctx.image) {
    return null;
  }
  const data = coverSample(ctx.image, cols, rows, ctx);
  const by = shapeByOf(v);
  return Float32Array.from({ length: cols * rows }, (_, i) => {
    const a = (data[i * 4 + 3] ?? 0) / 255;
    if (by === "alpha") {
      return a;
    }
    const lum =
      ((data[i * 4] ?? 0) * 0.299 +
        (data[i * 4 + 1] ?? 0) * 0.587 +
        (data[i * 4 + 2] ?? 0) * 0.114) /
      255;
    return (by === "light" ? lum : 1 - lum) * a;
  });
};

/** Noise that breathes: eased toward a second noise and back over the loop. */
const noise = (v: StudioValues, cols: number, rows: number): Float32Array => {
  const size = Math.max(5, numOr(v.noiseSize, 30)) / 100;
  const seed = Number(v.seed) || 1;
  const base = clouds(cols, rows, seed, size);
  const amount = Math.min(1, numOr(v.fieldDrift, 0));
  if (amount <= 0) {
    return base;
  }
  const mix = amount * (0.5 - 0.5 * Math.cos(TAU * numOr(v.fieldPhase, 0)));
  const other = clouds(cols, rows, seed + 1, size);
  return base.map((x, i) => x + ((other[i] ?? x) - x) * mix);
};

/**
 * Type and pictures don't move; a band of light passes across them
 * instead, strongest at mid-loop and off the piece at either end.
 */
const lit = (
  field: Float32Array,
  v: StudioValues,
  cols: number,
  rows: number
): Float32Array => {
  const amount = numOr(v.fieldDrift, 0);
  if (amount <= 0) {
    return field;
  }
  const centre = numOr(v.fieldPhase, 0) * 1.6 - 0.3;
  return field.map((x, i) => {
    const u = ((i % cols) + 0.5) / cols;
    const w = (Math.floor(i / cols) + 0.5) / rows;
    const d = u + w * 0.3 - centre;
    return x * (1 + 0.6 * amount * Math.exp(-(d * d) / 0.02));
  });
};

const raw = (
  v: StudioValues,
  ctx: RenderContext,
  cols: number,
  rows: number
): Float32Array => {
  if (v.source === "text") {
    return lit(maskOf(v, cols, rows).cover, v, cols, rows);
  }
  if (v.source === "picture") {
    const picture = pictured(v, ctx, cols, rows);
    return picture
      ? lit(picture, v, cols, rows)
      : new Float32Array(cols * rows);
  }
  if (v.source === "blobs") {
    return blobs(v, cols, rows, ctx.width / ctx.height);
  }
  if (v.source === "noise") {
    return noise(v, cols, rows);
  }
  return geometric(v, cols, rows, ctx.width / ctx.height);
};

/** The source as values 0–1 on a `cols` × `rows` grid, contrast applied. */
export const fieldOf = (
  v: StudioValues,
  ctx: RenderContext,
  cols: number,
  rows: number
): Float32Array => {
  const k = numOr(v.contrast, 100) / 100;
  const invert = v.invert === true;
  return raw(v, ctx, cols, rows).map((x) => {
    const t = Math.max(0, Math.min(1, (x - 0.5) * k + 0.5));
    return invert ? 1 - t : t;
  });
};

/** A field's value at a point (0–1 across and down), nearest cell. */
export const sampleAt = (
  field: Float32Array,
  cols: number,
  rows: number,
  u: number,
  w: number
): number => {
  const c = Math.min(cols - 1, Math.max(0, Math.floor(u * cols)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor(w * rows)));
  return field[r * cols + c] ?? 0;
};

/** Rows for a grid `cols` across that keeps cells square on this piece. */
export const rowsFor = (cols: number, ctx: RenderContext): number =>
  Math.max(1, Math.round((cols * ctx.height) / ctx.width));
