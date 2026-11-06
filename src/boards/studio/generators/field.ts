import type { RenderContext, StudioParam, StudioValues } from "../types";
import { clouds, coverSample, numOr } from "./cellField";
import { shapeByOf } from "./flowPicture";
import { FONTS, maskOf } from "./flowText";

/**
 * What shapes a pattern: a value from 0 to 1 over the piece, from typed
 * text, a picture (an object, the selection, a file), soft noise, waves
 * (crossing sine waves, the Durves look), a straight gradient or a radial
 * one. Shared by Halftone, Line Waves and Iso Blocks.
 */
export type FieldSource =
  | "gradient"
  | "noise"
  | "picture"
  | "radial"
  | "text"
  | "waves";

const LABELS: Record<FieldSource, string> = {
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
  if (v.source === "radial") {
    const d =
      Math.hypot((u - 0.5) * aspect, w - 0.5) / Math.hypot(aspect / 2, 0.5);
    return 1 - Math.min(1, d);
  }
  // Along the direction, 0 to 1 across the piece.
  const along =
    0.5 +
    ((u - 0.5) * dx * aspect + (w - 0.5) * dy) /
      (Math.abs(dx) * aspect + Math.abs(dy) || 1);
  if (v.source === "gradient") {
    return along;
  }
  // Waves: bands along the direction, bent by a sine across it (Durves).
  const across = 0.5 + ((u - 0.5) * -dy * aspect + (w - 0.5) * dx);
  const amp = numOr(v.waveAmp, 30) / 100;
  const bend = amp * Math.sin(TAU * numOr(v.waveCount, 4) * across * 0.25);
  return 0.5 + 0.5 * Math.sin(TAU * (numOr(v.waveFreq, 3) * along + bend));
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

const raw = (
  v: StudioValues,
  ctx: RenderContext,
  cols: number,
  rows: number
): Float32Array => {
  if (v.source === "text") {
    return maskOf(v, cols, rows).cover;
  }
  if (v.source === "picture") {
    return pictured(v, ctx, cols, rows) ?? new Float32Array(cols * rows);
  }
  if (v.source === "noise") {
    const size = Math.max(5, numOr(v.noiseSize, 30)) / 100;
    return clouds(cols, rows, Number(v.seed) || 1, size);
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
