import { loadFontRef } from "../../../theme/remoteFonts";
import type { StudioValues } from "../types";

/**
 * Systems Flow's type: the text drawn, fitted and spaced, as coverage on the
 * pixel grid (flow.ts fills the grid from it).
 */

export const FONTS = [
  "DM Sans",
  "Space Grotesk",
  "Inter",
  "Archivo",
  "JetBrains Mono",
];

const fontOf = (v: StudioValues) => {
  const family = FONTS.includes(String(v.font)) ? String(v.font) : "DM Sans";
  const weight = Number(v.weight) || 800;
  return { css: `${weight} 100px "${family}"`, family, weight };
};

const SAMPLES = 4;

/** Tracking in thousandths of an em, as type tools count it. */
const trackingOf = (v: StudioValues) =>
  Math.max(-300, Math.min(600, Number(v.tracking) || 0)) / 1000;

/**
 * Letter spacing on a canvas. Chrome and Safari have `letterSpacing`, which
 * keeps the font's own kerning; without it, the text is drawn a letter at a
 * time.
 */
const spaced = (g: CanvasRenderingContext2D, px: number) => {
  const c = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) {
    c.letterSpacing = `${px}px`;
    return true;
  }
  return false;
};

/** The text's width at the current font, spaced by `px` between letters. */
const widthOf = (g: CanvasRenderingContext2D, text: string, px: number) => {
  if (spaced(g, px)) {
    // letterSpacing adds a space after the last letter too.
    return g.measureText(text).width - px;
  }
  const chars = [...text];
  return (
    chars.reduce((w, ch) => w + g.measureText(ch).width, 0) +
    px * Math.max(0, chars.length - 1)
  );
};

const fillSpaced = (
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number
) => {
  if (spaced(g, px)) {
    g.fillText(text, x, y);
    return;
  }
  let at = x;
  for (const ch of text) {
    g.fillText(ch, at, y);
    at += g.measureText(ch).width + px;
  }
};

/** The text drawn white on a canvas `W` × `H`, fitted and placed. */
const drawText = (
  g: CanvasRenderingContext2D,
  v: StudioValues,
  text: string,
  W: number,
  H: number
) => {
  const font = fontOf(v);
  const track = trackingOf(v);
  g.font = font.css;
  const probe = g.measureText(text);
  const tall =
    probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent || 70;
  const wide = Math.max(1, widthOf(g, text, track * 100));
  const fit = Math.min((H * 0.92) / tall, (W * 0.96) / wide);
  const size = 100 * fit * ((Number(v.scale) || 100) / 100);
  g.font = `${font.weight} ${size}px "${font.family}"`;
  const px = track * size;
  const m = g.measureText(text);
  const width = widthOf(g, text, px);
  const x =
    {
      center: (W - width) / 2,
      left: W * 0.02,
      right: W - W * 0.02 - width,
    }[String(v.align || "center")] ?? (W - width) / 2;
  g.fillStyle = "#fff";
  fillSpaced(
    g,
    text,
    x,
    (H + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
    px
  );
};

/** Alpha averaged down to one value a cell. */
const coverage = (
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  W: number
) => {
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        const at = ((r * SAMPLES + sy) * W + c * SAMPLES) * 4 + 3;
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          sum += data[at + sx * 4] ?? 0;
        }
      }
      out[r * cols + c] = sum / (SAMPLES * SAMPLES * 255);
    }
  }
  return out;
};

/** Whether the face is loaded; asks for it if not (the preview redraws). */
const fontReady = (v: StudioValues) => {
  const font = fontOf(v);
  loadFontRef(`g:${font.family}`);
  const ready = document.fonts.check(font.css);
  if (!ready) {
    void document.fonts.load(font.css);
  }
  return ready;
};

/** The text as coverage on the grid, 0 to 1 per cell; kept per settings. */
const masks = new Map<string, Float32Array>();
export const maskOf = (v: StudioValues, cols: number, rows: number) => {
  const text = String(v.text ?? "").slice(0, 24) || " ";
  const ready = fontReady(v);
  const key = [
    text,
    fontOf(v).css,
    cols,
    rows,
    v.scale,
    v.align,
    v.tracking,
    ready,
  ].join("|");
  const kept = masks.get(key);
  if (kept) {
    return kept;
  }
  const canvas = document.createElement("canvas");
  canvas.width = cols * SAMPLES;
  canvas.height = rows * SAMPLES;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  let out = new Float32Array(cols * rows);
  if (g) {
    drawText(g, v, text, canvas.width, canvas.height);
    const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
    out = coverage(data, cols, rows, canvas.width);
  }
  if (masks.size > 24) {
    masks.clear();
  }
  masks.set(key, out);
  return out;
};
