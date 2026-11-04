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
 * keeps the font's own kerning when a run of text is measured.
 */
const spaced = (g: CanvasRenderingContext2D, px: number) => {
  const c = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) {
    c.letterSpacing = `${px}px`;
    return true;
  }
  return false;
};

/**
 * Where each letter of a line starts, and the line's width. Measured as the
 * run of text up to each letter, so kerning between letters is kept even
 * though each one is drawn on its own (to know which letter a pixel is in).
 */
const lettersOf = (
  g: CanvasRenderingContext2D,
  line: string,
  px: number
): { at: number[]; width: number } => {
  const chars = [...line];
  const native = spaced(g, px);
  const at: number[] = [];
  let run = "";
  let manual = 0;
  for (const ch of chars) {
    at.push(native ? g.measureText(run).width : manual);
    run += ch;
    manual += g.measureText(ch).width + px;
  }
  const full = native
    ? g.measureText(line).width - (chars.length > 0 ? px : 0)
    : manual - (chars.length > 0 ? px : 0);
  spaced(g, 0);
  return { at, width: Math.max(0, full) };
};

/** Line spacing, as a share of the type size. */
const leadingOf = (v: StudioValues) =>
  Math.max(0.6, Math.min(2, (Number(v.leading) || 95) / 100));

/**
 * The text drawn on a canvas `W` × `H`, fitted and placed, a line at a time
 * and a letter at a time. Each letter is drawn in a colour that names it
 * (red = its place in the text + 1), so the grid can tell which letter each
 * pixel belongs to and colour it on its own.
 */
const drawText = (
  g: CanvasRenderingContext2D,
  v: StudioValues,
  text: string,
  W: number,
  H: number
) => {
  const font = fontOf(v);
  const track = trackingOf(v);
  const lead = leadingOf(v);
  const lines = text.split("\n");
  g.font = font.css;
  const first = g.measureText(lines[0] || " ");
  const last = g.measureText(lines.at(-1) || " ");
  const ascent = first.actualBoundingBoxAscent || 70;
  const descent = last.actualBoundingBoxDescent || 0;
  const tall = ascent + descent + (lines.length - 1) * 100 * lead;
  const wide = Math.max(
    1,
    ...lines.map((l) => lettersOf(g, l, track * 100).width)
  );
  const fit = Math.min((H * 0.92) / tall, (W * 0.96) / wide);
  const k = fit * ((Number(v.scale) || 100) / 100);
  const size = 100 * k;
  g.font = `${font.weight} ${size}px "${font.family}"`;
  const px = track * size;
  const top = (H - tall * k) / 2 + ascent * k;
  let index = 0;
  lines.forEach((line, n) => {
    const { at, width } = lettersOf(g, line, px);
    const x =
      {
        center: (W - width) / 2,
        left: W * 0.02,
        right: W - W * 0.02 - width,
      }[String(v.align || "center")] ?? (W - width) / 2;
    const y = top + n * size * lead;
    [...line].forEach((ch, i) => {
      g.fillStyle = `rgb(${Math.min(255, index + i + 1)},0,0)`;
      g.fillText(ch, x + (at[i] ?? 0), y);
    });
    // The newline is a place in the text too.
    index += [...line].length + 1;
  });
};

/**
 * Per cell: how much of it the type covers, 0 to 1, and which letter it's
 * in (its place in the text, or -1).
 */
const coverage = (
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  W: number
) => {
  const cover = new Float32Array(cols * rows);
  const letter = new Int16Array(cols * rows).fill(-1);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = 0;
      let best = 0;
      let which = -1;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        const at = ((r * SAMPLES + sy) * W + c * SAMPLES) * 4;
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const alpha = data[at + sx * 4 + 3] ?? 0;
          sum += alpha;
          if (alpha > best) {
            best = alpha;
            which = (data[at + sx * 4] ?? 0) - 1;
          }
        }
      }
      cover[r * cols + c] = sum / (SAMPLES * SAMPLES * 255);
      letter[r * cols + c] = which;
    }
  }
  return { cover, letter };
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
export interface TypeMask {
  cover: Float32Array;
  /** Each cell's letter: its place in the text, or -1 outside the type. */
  letter: Int16Array;
}
const masks = new Map<string, TypeMask>();
export const MAX_TEXT = 200;
export const maskOf = (
  v: StudioValues,
  cols: number,
  rows: number
): TypeMask => {
  const text = String(v.text ?? "").slice(0, MAX_TEXT) || " ";
  const ready = fontReady(v);
  const key = [
    text,
    fontOf(v).css,
    cols,
    rows,
    v.scale,
    v.align,
    v.tracking,
    v.leading,
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
  let out: TypeMask = {
    cover: new Float32Array(cols * rows),
    letter: new Int16Array(cols * rows).fill(-1),
  };
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
