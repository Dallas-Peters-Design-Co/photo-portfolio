import { loadFontRef } from "../../../theme/remoteFonts";
import { colorsOf } from "../chosenColors";
import { pick, r2, rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { paintOf } from "./mosaic";
import { drawPixels, type TileEmit } from "./mosaicPixels";

/**
 * Systems Flow: type (the big 2027 numbers) built from a fine grid of pixels,
 * in the look of the RoleModel site. Inside the letters the pixels line up in
 * lanes, getting denser and brighter along the flow; outside, loose pixels
 * scatter across the grid and drift in towards the letters.
 *
 * Scattered on one side, ordered on the other: hours turning into assets.
 */

const FONTS = [
  "DM Sans",
  "Space Grotesk",
  "Inter",
  "Archivo",
  "JetBrains Mono",
];

const SCATTER = ["#2f5e93", "#3a73b3", "#4a86c6"];

/** Which way the flow runs: where the loose pixels come from. */
type Dir = "left" | "right" | "top" | "bottom";

const fontOf = (v: StudioValues) => {
  const family = FONTS.includes(String(v.font)) ? String(v.font) : "DM Sans";
  const weight = Number(v.weight) || 800;
  return { css: `${weight} 100px "${family}"`, family, weight };
};

const SAMPLES = 4;

/** The text drawn white on a canvas `W` × `H`, fitted and placed. */
const drawText = (
  g: CanvasRenderingContext2D,
  v: StudioValues,
  text: string,
  W: number,
  H: number
) => {
  const font = fontOf(v);
  g.font = font.css;
  const probe = g.measureText(text);
  const tall =
    probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent || 70;
  const fit = Math.min(
    (H * 0.92) / tall,
    (W * 0.96) / Math.max(1, probe.width)
  );
  const size = 100 * fit * ((Number(v.scale) || 100) / 100);
  g.font = `${font.weight} ${size}px "${font.family}"`;
  const m = g.measureText(text);
  const left = W * 0.02 + m.actualBoundingBoxLeft;
  const x =
    {
      center: (W - m.width) / 2,
      left,
      right: W - W * 0.02 - m.width,
    }[String(v.align || "center")] ?? (W - m.width) / 2;
  g.fillStyle = "#fff";
  g.fillText(
    text,
    x,
    (H + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
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
const maskOf = (v: StudioValues, cols: number, rows: number) => {
  const text = String(v.text ?? "").slice(0, 24) || " ";
  const ready = fontReady(v);
  const key = [text, fontOf(v).css, cols, rows, v.scale, v.align, ready].join(
    "|"
  );
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

const STEPS: Record<Dir, [number, number]> = {
  bottom: [0, -1],
  left: [1, 0],
  right: [-1, 0],
  top: [0, 1],
};

/** How many cells each cell is from the letters, looking with the flow. */
const reachOf = (
  inside: (c: number, r: number) => boolean,
  cols: number,
  rows: number,
  dir: Dir,
  max: number
) => {
  const out = new Float32Array(cols * rows).fill(Number.POSITIVE_INFINITY);
  const [dx, dy] = STEPS[dir];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      for (let k = 1; k <= max; k += 1) {
        if (inside(c + dx * k, r + dy * k)) {
          out[r * cols + c] = k;
          break;
        }
      }
    }
  }
  return out;
};

const withAlpha = (colour: string, a: number) =>
  `${colour.slice(0, 7)}${Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0")}`;

const DIRS: Dir[] = ["left", "right", "top", "bottom"];

/** The settings, read once for a whole redraw. */
const setupOf = (v: StudioValues, ctx: RenderContext) => {
  const cols = Math.max(10, Number(v.columns) || 110);
  const cell = ctx.width / cols;
  const rows = Math.max(1, Math.round(ctx.height / cell));
  const mask = maskOf(v, cols, rows);
  const inside = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && (mask[r * cols + c] ?? 0) > 0.5;
  const dir = DIRS.find((d) => d === v.flow) ?? "left";
  const drift = (Number(v.drift) || 0) / 100;
  const reachMax = Math.max(1, Math.round(cols * 0.25 * drift));
  return {
    cell,
    cols,
    dir,
    drift,
    fill: (Number(v.density) || 0) / 100,
    inset: cell * ((Number(v.gap) || 0) / 200),
    inside,
    lanes: Math.max(0, Number(v.lanes) || 0),
    loose: colorsOf(v.scatter, SCATTER, 3),
    order: (Number(v.order) || 0) / 100,
    reach: drift > 0 ? reachOf(inside, cols, rows, dir, reachMax) : null,
    reachMax,
    rows,
    scatter: (Number(v.noise) || 0) / 100,
    shape: ctx.palette.length > 0 ? ctx.palette : ["#d9bd1c"],
  };
};
type Setup = ReturnType<typeof setupOf>;

/** 0 where the flow starts, 1 where it ends. */
const alongOf = (o: Setup, c: number, r: number) =>
  ({
    bottom: 1 - r / o.rows,
    left: c / o.cols,
    right: 1 - c / o.cols,
    top: r / o.rows,
  })[o.dir];

/** A pixel in the letters: lanes, denser and brighter along the flow. */
const letterPixel = (
  o: Setup,
  r: number,
  along: number,
  rand: () => number
): string | null => {
  const a = rand();
  const b = rand();
  const lane = o.lanes === 0 || r % (o.lanes + 1) !== o.lanes;
  const p = lane
    ? o.fill * (1 - o.order + o.order * along) + o.order * 0.15
    : 0.12;
  if (a < p) {
    const i =
      b < 0.2 + along * 0.5
        ? o.shape.length - 1
        : Math.floor(b * o.shape.length);
    return withAlpha(pick(o.shape, i), 0.6 + rand() * 0.4);
  }
  if (a < p + 0.18 * (1 - along)) {
    return withAlpha(pick(o.loose, Math.floor(b * o.loose.length)), 0.7);
  }
  return null;
};

/** A pixel around the letters: loose scatter, thicker as it drifts in. */
const loosePixel = (
  o: Setup,
  at: number,
  along: number,
  rand: () => number
): string | null => {
  const a = rand();
  const b = rand();
  const d = o.reach?.[at] ?? Number.POSITIVE_INFINITY;
  const near = Number.isFinite(d) ? 1 - d / (o.reachMax + 1) : 0;
  const p = o.scatter * 0.14 * (1 - along * 0.6) + o.drift * near * near * 0.45;
  if (a >= p) {
    return null;
  }
  const own = near > 0.35 && b < 0.45;
  return withAlpha(
    own ? pick(o.shape, 0) : pick(o.loose, Math.floor(b * o.loose.length)),
    0.45 + rand() * 0.55
  );
};

/** Every pixel of the piece: where it is and its colour. */
const eachPixel = (v: StudioValues, ctx: RenderContext, emit: TileEmit) => {
  const o = setupOf(v, ctx);
  const s = o.cell - o.inset * 2;
  const rand = rng(Number(v.seed) || 1);
  for (let r = 0; r < o.rows; r += 1) {
    for (let c = 0; c < o.cols; c += 1) {
      const along = alongOf(o, c, r);
      const colour = o.inside(c, r)
        ? letterPixel(o, r, along, rand)
        : loosePixel(o, r * o.cols + c, along, rand);
      if (colour) {
        emit(
          "square",
          c * o.cell + o.inset,
          r * o.cell + o.inset,
          s,
          colour,
          false
        );
      }
    }
  }
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0c2a2e");

export const flowTool: ImageTool = {
  blurb:
    "Big type made of fine pixels in lanes, with loose pixels scattering and drifting in. The site's systems-flow look, for the 2027 numbers.",
  draw: (g, v, ctx) =>
    drawPixels(g, ctx, groundOf(v), (emit) => eachPixel(v, ctx, emit)),
  id: "flow",
  kind: "image",
  name: "Systems Flow",
  params: [
    { default: "2", key: "text", label: "Text", type: "text" },
    {
      default: "DM Sans",
      key: "font",
      label: "Font",
      options: FONTS.map((f) => ({ label: f, value: f })),
      type: "select",
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
    },
    {
      default: 100,
      key: "scale",
      label: "Text size",
      max: 140,
      min: 30,
      type: "range",
    },
    {
      default: "center",
      key: "align",
      label: "Place",
      options: [
        { label: "Centre", value: "center" },
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
      type: "select",
    },
    {
      default: 110,
      key: "columns",
      label: "Pixels across",
      max: 260,
      min: 30,
      type: "range",
    },
    { default: 18, key: "gap", label: "Gap", max: 60, min: 0, type: "range" },
    {
      default: 2,
      key: "lanes",
      label: "Lanes (rows between gaps)",
      max: 6,
      min: 0,
      type: "range",
    },
    {
      default: 80,
      key: "density",
      label: "Fill",
      max: 100,
      min: 10,
      type: "range",
    },
    {
      default: 60,
      key: "order",
      label: "Order along the flow",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: 30,
      key: "noise",
      label: "Scatter",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: 45,
      key: "drift",
      label: "Drift in",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: "left",
      key: "flow",
      label: "Flows from",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
        { label: "Top", value: "top" },
        { label: "Bottom", value: "bottom" },
      ],
      type: "select",
    },
    {
      count: 3,
      key: "colors",
      label: "Type colours (dark to bright)",
      max: 5,
      type: "colors",
    },
    {
      count: 3,
      key: "scatter",
      label: "Scatter colours",
      max: 5,
      type: "colors",
    },
    {
      default: true,
      key: "fill",
      label: "Fill the background",
      type: "checkbox",
    },
    {
      default: "#0c2a2e",
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
    eachPixel(v, ctx, (_kind, x, y, s, colour) => {
      const fill = paintOf(colour);
      if (fill) {
        parts.push(
          `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(s)}" height="${r2(s)}" ${fill}/>`
        );
      }
    });
    return svgDoc(ctx.width, ctx.height, parts.join(""));
  },
  vector: true,
};
