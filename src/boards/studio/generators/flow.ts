import { colorsOf } from "../chosenColors";
import { pick, r2, rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { FLOW_PARAMS } from "./flowParams";
import { pictureMask } from "./flowPicture";
import { maskOf } from "./flowText";
import { drawGrid, gridFrom, gridSvg, linesLook } from "./gridLines";
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
 * Colours given to single letters: a comma list in step with the text, each
 * entry a letter's own colours (dark to bright) joined by "|", empty where a
 * letter keeps the type colours ("#a|#b|#c,,,#8fd6e8").
 */
export const letterColoursOf = (value: unknown): Map<number, string[]> =>
  new Map(
    (typeof value === "string" ? value.split(",") : [])
      .map(
        (entry, i) =>
          [
            i,
            entry
              .split("|")
              .map((c) => c.trim())
              .filter((c) => HEX.test(c)),
          ] as const
      )
      .filter(([, set]) => set.length > 0)
  );

const flowColumns = (v: StudioValues) => Math.max(10, Number(v.columns) || 110);

/** The settings, read once for a whole redraw. */
const setupOf = (v: StudioValues, ctx: RenderContext) => {
  const cols = flowColumns(v);
  const cell = ctx.width / cols;
  const rows = Math.max(1, Math.round(ctx.height / cell));
  // A picture's shape (an object from the frame, a logo) or the typed text.
  const mask =
    v.source === "picture" && ctx.image
      ? pictureMask(v, ctx.image, cols, rows)
      : maskOf(v, cols, rows);
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
    // Grid lines take the gap's place: the pixels meet under them.
    inset: v.lines === true ? 0 : cell * ((Number(v.gap) || 0) / 200),
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
  // A letter given its own colours draws from them, with the same lanes.
  const shape = o.letterColours.get(o.letter[at] ?? -1) ?? o.shape;
  const lane = o.lanes === 0 || r % (o.lanes + 1) !== o.lanes;
  const p = lane
    ? o.fill * (1 - o.order + o.order * along) + o.order * 0.15
    : 0.12;
  if (a < p) {
    const i =
      b < 0.2 + along * 0.5 ? shape.length - 1 : Math.floor(b * shape.length);
    return withAlpha(pick(shape, i), 0.6 + rand() * 0.4);
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

/** The cut grown by one cell each way. */
const grown = (cut: Uint8Array, cols: number, rows: number): Uint8Array => {
  const next = cut.slice();
  for (let at = 0; at < cut.length; at += 1) {
    const c = at % cols;
    const r = (at - c) / cols;
    const near =
      (c > 0 && cut[at - 1]) ||
      (c < cols - 1 && cut[at + 1]) ||
      (r > 0 && cut[at - cols]) ||
      (r < rows - 1 && cut[at + cols]);
    if (near) {
      next[at] = 1;
    }
  }
  return next;
};

/**
 * The cells a cutout leaves empty: the letters, grown by `margin` cells all
 * round so the field keeps a clean edge off them.
 */
export const cutOf = (o: Setup, margin: number): Uint8Array => {
  const { cols, rows } = o;
  let cut: Uint8Array = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cut[r * cols + c] = o.inside(c, r) ? 1 : 0;
    }
  }
  for (let step = 0; step < margin; step += 1) {
    cut = grown(cut, cols, rows);
  }
  return cut;
};

/** A cell's colour: the type, the scatter round it, or (cut out) the field. */
const pixelAt = (
  o: Setup,
  cut: Uint8Array | null,
  c: number,
  r: number,
  rand: () => number
): string | null => {
  const at = r * o.cols + c;
  const along = alongOf(o, c, r);
  if (cut) {
    // The field fills everywhere but the letters, laned like the type.
    return cut[at] ? null : letterPixel(o, r, along, rand, -1);
  }
  return o.inside(c, r)
    ? letterPixel(o, r, along, rand, at)
    : loosePixel(o, at, along, rand);
};

/** Every pixel of the piece: where it is and its colour. */
const eachPixel = (v: StudioValues, ctx: RenderContext, emit: TileEmit) => {
  const o = setupOf(v, ctx);
  const cut =
    v.cutout === true ? cutOf(o, Math.max(0, Number(v.margin) || 0)) : null;
  const s = o.cell - o.inset * 2;
  const rand = rng(Number(v.seed) || 1);
  for (let r = 0; r < o.rows; r += 1) {
    for (let c = 0; c < o.cols; c += 1) {
      const colour = pixelAt(o, cut, c, r, rand);
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
  draw: (g, v, ctx) => {
    drawPixels(g, ctx, groundOf(v), (emit) => eachPixel(v, ctx, emit));
    drawGrid(g, gridFrom(flowColumns(v), ctx), linesLook(v), ctx);
  },
  id: "flow",
  kind: "image",
  name: "Systems Flow",
  params: FLOW_PARAMS,
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
    parts.push(gridSvg(gridFrom(flowColumns(v), ctx), linesLook(v), ctx));
    return svgDoc(ctx.width, ctx.height, parts.join(""));
  },
  vector: true,
};
