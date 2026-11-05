import { r2, rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { clouds, coverSample, lumAt } from "./cellField";
import { edgeFadeOf, FADE_PARAMS, fadeCell } from "./edgeFade";
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
  // Generated clouds sit around the middle; spread them over every tone so
  // there's real black, real light and everything between.
  if (v.source !== "picture" && v.spread !== "soft") {
    // …leaning dark, so most of it is sparse dots on black.
    base = spreadOut(base).map((t) => t ** 1.6);
  }
  const block = Math.max(1, Number(v.block) || 1);
  return v.patches === "even"
    ? patched(base, cols, rows, block)
    : varied(base, cols, rows, block, seed);
};

/** Each value replaced by its rank: an even spread from 0 to 1. */
const spreadOut = (base: Float32Array): Float32Array => {
  const order = Array.from(base.keys()).sort(
    (a, b) => (base[a] ?? 0) - (base[b] ?? 0)
  );
  const out = new Float32Array(base.length);
  order.forEach((at, rank) => {
    out[at] = rank / Math.max(1, order.length - 1);
  });
  return out;
};

/**
 * Patches of mixed sizes, like a data readout: the grid is split into
 * rectangles, smaller where the tone changes and larger where it's even
 * (never bigger than `most` cells), and each takes its average tone.
 */
const varied = (
  base: Float32Array,
  cols: number,
  rows: number,
  most: number,
  seed: number
) => {
  const out = new Float32Array(base.length);
  const rand = rng(seed + 29);
  const leaf = (x: number, y: number, w: number, h: number) => {
    // Each patch nudged off its neighbours' tone, so the edges read.
    const tone = meanOf(base, cols, x, y, w, h) + (rand() - 0.5) * 0.3;
    for (let r = y; r < y + h; r += 1) {
      out.fill(Math.max(0, Math.min(1, tone)), r * cols + x, r * cols + x + w);
    }
  };
  const fill = (x: number, y: number, w: number, h: number) => {
    const long = Math.max(w, h);
    // Bigger than the most allowed always splits; below it, by chance,
    // down to about three cells, so the sizes vary.
    if (!(long > most || (long >= 6 && rand() < 0.3))) {
      leaf(x, y, w, h);
      return;
    }
    const k = 0.3 + rand() * 0.4;
    if (w > h || (w === h && rand() < 0.5)) {
      const a = Math.max(3, Math.min(w - 3, Math.round(w * k)));
      fill(x, y, a, h);
      fill(x + a, y, w - a, h);
    } else {
      const a = Math.max(3, Math.min(h - 3, Math.round(h * k)));
      fill(x, y, w, a);
      fill(x, y + a, w, h - a);
    }
  };
  fill(0, 0, cols, rows);
  return out;
};

const meanOf = (
  base: Float32Array,
  cols: number,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  let sum = 0;
  for (let r = y; r < y + h; r += 1) {
    for (let c = x; c < x + w; c += 1) {
      sum += base[r * cols + c] ?? 0;
    }
  }
  return sum / Math.max(1, w * h);
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
  // Lit cells sit inside their cells, the grid lines between (as in a
  // printed readout), so the gap stays with or without lines.
  const inset = g.cell * ((Number(v.gap) || 0) / 200);
  const s = g.cell - inset * 2;
  const matrix = BAYER[String(v.pattern)] ?? null;
  const rand = rng((Number(v.seed) || 1) + 7);
  const ink = String(v.ink || "#ffffff");
  const fade = edgeFadeOf(v, g.cols, g.rows);
  for (let r = 0; r < g.rows; r += 1) {
    for (let c = 0; c < g.cols; c += 1) {
      const t = adjust(tones[r * g.cols + c] ?? 0, v);
      const cut = matrix
        ? ((matrix[r % matrix.length]?.[c % matrix.length] ?? 0) + 0.5) /
          matrix.length ** 2
        : rand();
      const colour = t > cut ? fadeCell(fade, c, r, ink) : null;
      if (colour) {
        emit(
          "square",
          c * g.cell + inset,
          r * g.cell + inset,
          s,
          colour,
          false
        );
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
  looks: [
    { name: "Readout (sparse patches)", values: {} },
    {
      name: "Fade down (soft)",
      values: {
        block: 6,
        columns: 96,
        contrast: 120,
        gap: 0,
        levels: 9,
        lineColour: "#ffffff26",
        patches: "even",
        seed: 4,
        source: "fade",
        spread: "soft",
      },
    },
    {
      name: "From a picture",
      values: {
        block: 3,
        columns: 120,
        contrast: 120,
        gap: 0,
        levels: 9,
        lineColour: "#ffffff26",
        patches: "even",
        source: "picture",
      },
    },
    {
      name: "Brand readout (teal)",
      values: {
        bg: "#0c2a2e",
        ink: "#8fd6e8",
        lineColour: "#8fd6e833",
        seed: 5,
      },
    },
    {
      name: "Words: dense over sparse",
      values: {
        bg: "#0c2a2e",
        block: 2,
        columns: 150,
        contrast: 100,
        gap: 30,
        ink: "#8fd6e8",
        levels: 7,
        lineColour: "#8fd6e822",
        patches: "even",
        source: "picture",
      },
    },
  ],
  name: "Dither Grid",
  params: [
    {
      default: "clouds",
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
      default: "full",
      key: "spread",
      label: "Tone range",
      options: [
        { label: "Full range, leaning dark", value: "full" },
        { label: "Soft, as the clouds fall", value: "soft" },
      ],
      type: "select",
      when: (v) => v.source !== "picture",
    },
    {
      default: 72,
      key: "columns",
      label: "Cells across",
      max: 240,
      min: 8,
      type: "range",
    },
    {
      default: "varied",
      key: "patches",
      label: "Patches",
      options: [
        { label: "Mixed sizes", value: "varied" },
        { label: "Even squares", value: "even" },
      ],
      type: "select",
    },
    {
      default: 12,
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
      default: 7,
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
      default: 110,
      key: "contrast",
      label: "Contrast",
      max: 300,
      min: 0,
      type: "range",
    },
    { default: false, key: "invert", label: "Invert", type: "checkbox" },
    {
      default: 44,
      key: "gap",
      label: "Gap",
      max: 80,
      min: 0,
      type: "range",
    },
    ...gridParams({ lineColour: "#ffffff30", lines: true, lineWidth: 1 }),
    ...FADE_PARAMS,
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
