import { colorsOf } from "../chosenColors";
import { pick, r2, rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { FONTS, maskOf } from "./flowText";
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

const SCATTER = ["#2f5e93", "#3a73b3", "#4a86c6"];

/** Which way the flow runs: where the loose pixels come from. */
type Dir = "left" | "right" | "top" | "bottom";

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

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Colours given to single letters: a comma list in step with the text,
 * empty where a letter keeps the type colours ("#f3e9a3,,,#8fd6e8").
 */
export const letterColoursOf = (value: unknown): Map<number, string> =>
  new Map(
    (typeof value === "string" ? value.split(",") : [])
      .map((c, i) => [i, c.trim()] as const)
      .filter(([, c]) => HEX.test(c))
  );

/** The settings, read once for a whole redraw. */
const setupOf = (v: StudioValues, ctx: RenderContext) => {
  const cols = Math.max(10, Number(v.columns) || 110);
  const cell = ctx.width / cols;
  const rows = Math.max(1, Math.round(ctx.height / cell));
  const mask = maskOf(v, cols, rows);
  const inside = (c: number, r: number) =>
    c >= 0 &&
    r >= 0 &&
    c < cols &&
    r < rows &&
    (mask.cover[r * cols + c] ?? 0) > 0.5;
  const letterColours = letterColoursOf(v.charColors);
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
    letter: mask.letter,
    letterColours,
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
  rand: () => number,
  at: number
): string | null => {
  const a = rand();
  const b = rand();
  // A letter given its own colour is drawn in it, with the same lanes.
  const own = o.letterColours.get(o.letter[at] ?? -1);
  const lane = o.lanes === 0 || r % (o.lanes + 1) !== o.lanes;
  const p = lane
    ? o.fill * (1 - o.order + o.order * along) + o.order * 0.15
    : 0.12;
  if (a < p) {
    const i =
      b < 0.2 + along * 0.5
        ? o.shape.length - 1
        : Math.floor(b * o.shape.length);
    return withAlpha(own ?? pick(o.shape, i), 0.6 + rand() * 0.4);
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
        ? letterPixel(o, r, along, rand, r * o.cols + c)
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
    {
      default: "2",
      key: "text",
      label: "Text",
      multiline: true,
      type: "text",
    },
    { key: "charColors", label: "Letter colours", of: "text", type: "letters" },
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
      default: 0,
      key: "tracking",
      label: "Letter spacing",
      max: 600,
      min: -300,
      step: 5,
      type: "range",
    },
    {
      default: 95,
      key: "leading",
      label: "Line spacing",
      max: 200,
      min: 60,
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
