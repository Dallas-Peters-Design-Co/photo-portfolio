import { r2, rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { clouds, coverSample, lumAt } from "./cellField";
import {
  drawGrid,
  gridFrom,
  gridParams,
  gridSvg,
  linesLook,
} from "./gridLines";
import { drawPixels, type TileEmit } from "./mosaicPixels";
import { paintOf } from "./mosaicSvg";

/**
 * Dither Grid: a fine grid of cells, each on or off, in ordered-dither
 * patterns (a checker, one in four, one in sixteen…) so tone is made from
 * how many cells are lit. Patches of cells share a tone, which gives the
 * blocky, data-like look. From a picture or from soft generated clouds.
 */

const BAYER: Record<string, number[][]> = {
  bayer2: [
    [0, 2],
    [3, 1],
  ],
  bayer4: [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ],
};
BAYER.bayer8 = Array.from({ length: 8 }, (_, y) =>
  Array.from({ length: 8 }, (__, x) => {
    const b4 = BAYER.bayer4 as number[][];
    const b2 = BAYER.bayer2 as number[][];
    return (
      4 * (b4[y % 4]?.[x % 4] ?? 0) +
      (b2[Math.floor(y / 4)]?.[Math.floor(x / 4)] ?? 0)
    );
  })
);

/** Each cell's tone, 0 (off) to 1 (on), before dithering. */
const tonesOf = (
  v: StudioValues,
  ctx: RenderContext,
  cols: number,
  rows: number
) => {
  const n = cols * rows;
  const seed = Number(v.seed) || 1;
  let base: Float32Array;
  if (v.source === "picture" && ctx.image) {
    const data = coverSample(ctx.image, cols, rows, ctx);
    base = Float32Array.from({ length: n }, (_, i) => lumAt(data, i));
  } else {
    const size = Math.max(5, Number(v.size) || 30) / 100;
    base = clouds(cols, rows, seed, size);
    if (v.source === "fade") {
      // Lit at the top, falling away down the piece, clouds through it.
      base = base.map((c, i) => {
        const r = Math.floor(i / cols) / Math.max(1, rows - 1);
        return Math.max(0, Math.min(1, (1 - r) * 0.85 + (c - 0.5) * 0.6));
      });
    }
  }
  return patched(base, cols, rows, Math.max(1, Number(v.block) || 1));
};

/** Cells averaged in square patches, so each patch is one tone. */
const patched = (base: Float32Array, cols: number, rows: number, b: number) => {
  if (b <= 1) {
    return base;
  }
  const out = new Float32Array(base.length);
  for (let by = 0; by < rows; by += b) {
    for (let bx = 0; bx < cols; bx += b) {
      let sum = 0;
      let count = 0;
      for (let r = by; r < Math.min(rows, by + b); r += 1) {
        for (let c = bx; c < Math.min(cols, bx + b); c += 1) {
          sum += base[r * cols + c] ?? 0;
          count += 1;
        }
      }
      for (let r = by; r < Math.min(rows, by + b); r += 1) {
        for (let c = bx; c < Math.min(cols, bx + b); c += 1) {
          out[r * cols + c] = sum / count;
        }
      }
    }
  }
  return out;
};

/** A tone after brightness, contrast, levels and invert. */
const adjust = (t: number, v: StudioValues) => {
  const contrast = (Number(v.contrast) || 100) / 100;
  const bright = (Number(v.brightness) || 0) / 100;
  const levels = Math.max(2, Number(v.levels) || 9);
  let x = (t - 0.5) * contrast + 0.5 + bright;
  x = Math.max(0, Math.min(1, x));
  if (v.invert === true) {
    x = 1 - x;
  }
  return Math.round(x * (levels - 1)) / (levels - 1);
};

/** Every lit cell: where it is. */
const eachCell = (v: StudioValues, ctx: RenderContext, emit: TileEmit) => {
  const g = gridFrom(Math.max(8, Number(v.columns) || 96), ctx);
  const tones = tonesOf(v, ctx, g.cols, g.rows);
  const inset = v.lines === true ? 0 : g.cell * ((Number(v.gap) || 0) / 200);
  const s = g.cell - inset * 2;
  const matrix = BAYER[String(v.pattern)] ?? null;
  const rand = rng((Number(v.seed) || 1) + 7);
  const ink = String(v.ink || "#ffffff");
  for (let r = 0; r < g.rows; r += 1) {
    for (let c = 0; c < g.cols; c += 1) {
      const t = adjust(tones[r * g.cols + c] ?? 0, v);
      const cut = matrix
        ? ((matrix[r % matrix.length]?.[c % matrix.length] ?? 0) + 0.5) /
          matrix.length ** 2
        : rand();
      if (t > cut) {
        emit("square", c * g.cell + inset, r * g.cell + inset, s, ink, false);
      }
    }
  }
  return g;
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#000000");

export const ditherTool: ImageTool = {
  blurb:
    "A fine grid of lit and dark cells in ordered-dither patterns, in patches of tone: from a picture or soft generated clouds.",
  draw: (g, v, ctx) => {
    let grid = gridFrom(Math.max(8, Number(v.columns) || 96), ctx);
    drawPixels(g, ctx, groundOf(v), (emit) => {
      grid = eachCell(v, ctx, emit);
    });
    drawGrid(g, grid, linesLook(v), ctx);
  },
  id: "dither",
  kind: "image",
  name: "Dither Grid",
  params: [
    {
      default: "fade",
      key: "source",
      label: "Made from",
      options: [
        { label: "Clouds, fading down", value: "fade" },
        { label: "Clouds", value: "clouds" },
        { label: "A picture", value: "picture" },
      ],
      type: "select",
    },
    {
      key: "image",
      label: "Picture",
      type: "image",
      when: (v) => v.source === "picture",
    },
    {
      default: 30,
      key: "size",
      label: "Cloud size",
      max: 100,
      min: 5,
      type: "range",
      when: (v) => v.source !== "picture",
    },
    {
      default: 96,
      key: "columns",
      label: "Cells across",
      max: 240,
      min: 8,
      type: "range",
    },
    {
      default: 6,
      key: "block",
      label: "Patch size (cells)",
      max: 24,
      min: 1,
      type: "range",
    },
    {
      default: "bayer4",
      key: "pattern",
      label: "Pattern",
      options: [
        { label: "Ordered 4×4", value: "bayer4" },
        { label: "Ordered 2×2 (checks)", value: "bayer2" },
        { label: "Ordered 8×8 (finer steps)", value: "bayer8" },
        { label: "Random", value: "random" },
      ],
      type: "select",
    },
    {
      default: 9,
      key: "levels",
      label: "Tones",
      max: 17,
      min: 2,
      type: "range",
    },
    {
      default: 0,
      key: "brightness",
      label: "Brightness",
      max: 100,
      min: -100,
      type: "range",
    },
    {
      default: 120,
      key: "contrast",
      label: "Contrast",
      max: 300,
      min: 0,
      type: "range",
    },
    { default: false, key: "invert", label: "Invert", type: "checkbox" },
    {
      default: 30,
      key: "gap",
      label: "Gap",
      max: 80,
      min: 0,
      type: "range",
      when: (v) => v.lines !== true,
    },
    ...gridParams({ lineColour: "#ffffff26", lines: true, lineWidth: 1 }),
    { default: "#ffffff", key: "ink", label: "Cells", type: "color" },
    {
      default: true,
      key: "fill",
      label: "Fill the background",
      type: "checkbox",
    },
    {
      default: "#000000",
      key: "bg",
      label: "Background",
      type: "color",
      when: (v) => v.fill !== false,
    },
    { key: "seed", label: "Variation", type: "seed" },
  ],
  render: (v, ctx) => {
    const ground = groundOf(v);
    const groundPaint = ground ? paintOf(ground) : null;
    const parts: string[] = groundPaint
      ? [`<rect width="${ctx.width}" height="${ctx.height}" ${groundPaint}/>`]
      : [];
    const grid = eachCell(v, ctx, (_k, x, y, s, colour) => {
      const fill = paintOf(colour);
      if (fill) {
        parts.push(
          `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(s)}" height="${r2(s)}" ${fill}/>`
        );
      }
    });
    parts.push(gridSvg(grid, linesLook(v), ctx));
    return svgDoc(ctx.width, ctx.height, parts.join(""));
  },
  vector: true,
};
