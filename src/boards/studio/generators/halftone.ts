import { pick } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numOr } from "./cellField";
import { edgeFadeOf, FADE_PARAMS, fadeCell } from "./edgeFade";
import { fieldOf, fieldParams, rowsFor, sampleAt } from "./field";
import { drawPrims, type Prim, primsDoc } from "./prims";

/**
 * Halftone: a screen of dots (or squares, diamonds, lines, crosses) sized by
 * a source: a picture, text, waves (the Durves look), noise or a gradient.
 * The screen can be turned, as print screens are. Vector, so it prints sharp.
 */

type Dot = "circle" | "cross" | "diamond" | "line" | "square";

interface Screen {
  angle: number;
  cell: number;
  cols: number;
  rows: number;
}

const screenOf = (v: StudioValues, ctx: RenderContext): Screen => {
  const cols = Math.max(6, Math.round(numOr(v.columns, 60)));
  return {
    angle: (numOr(v.angle, 0) * Math.PI) / 180,
    cell: ctx.width / cols,
    cols,
    rows: rowsFor(cols, ctx),
  };
};

/** Every screen point over the piece, turned about its centre. */
const pointsOf = (s: Screen, ctx: RenderContext): [number, number][] => {
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;
  const reach = Math.ceil(Math.hypot(ctx.width, ctx.height) / s.cell / 2) + 1;
  const cos = Math.cos(s.angle);
  const sin = Math.sin(s.angle);
  const out: [number, number][] = [];
  for (let j = -reach; j <= reach; j += 1) {
    for (let i = -reach; i <= reach; i += 1) {
      const gx = (i + 0.5) * s.cell;
      const gy = (j + 0.5) * s.cell;
      const x = cx + gx * cos - gy * sin;
      const y = cy + gx * sin + gy * cos;
      if (
        x > -s.cell &&
        y > -s.cell &&
        x < ctx.width + s.cell &&
        y < ctx.height + s.cell
      ) {
        out.push([x, y]);
      }
    }
  }
  return out;
};

const turn = (pts: number[], x: number, y: number, a: number): number[] => {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const px = pts[i] ?? 0;
    const py = pts[i + 1] ?? 0;
    out.push(x + px * cos - py * sin, y + px * sin + py * cos);
  }
  return out;
};

/** One mark, `size` 0–1 of a cell, centred on x, y. */
const markOf = (
  dot: Dot,
  x: number,
  y: number,
  size: number,
  s: Screen,
  fill: string
): Prim => {
  const h = (s.cell * size) / 2;
  if (dot === "circle") {
    return { fill, r: h, t: "circle", x, y };
  }
  if (dot === "line") {
    // A full-width bar whose thickness is the tone: a line screen.
    const w = s.cell / 2 + 0.3;
    return {
      fill,
      pts: turn([-w, -h, w, -h, w, h, -w, h], x, y, s.angle),
      t: "poly",
    };
  }
  if (dot === "diamond") {
    return {
      fill,
      pts: turn([0, -h, h, 0, 0, h, -h, 0], x, y, s.angle),
      t: "poly",
    };
  }
  if (dot === "cross") {
    const k = h / 3;
    return {
      fill,
      pts: turn(
        [
          -k,
          -h,
          k,
          -h,
          k,
          -k,
          h,
          -k,
          h,
          k,
          k,
          k,
          k,
          h,
          -k,
          h,
          -k,
          k,
          -h,
          k,
          -h,
          -k,
          -k,
          -k,
        ],
        x,
        y,
        s.angle
      ),
      t: "poly",
    };
  }
  return {
    fill,
    pts: turn([-h, -h, h, -h, h, h, -h, h], x, y, s.angle),
    t: "poly",
  };
};

const colourOf = (v: StudioValues, ctx: RenderContext, t: number): string => {
  if (v.colour === "tones") {
    const n = ctx.palette.length;
    return pick(ctx.palette, Math.min(n - 1, Math.floor(t * n)));
  }
  return String(v.ink || "#ffffff");
};

const marksOf = (v: StudioValues, ctx: RenderContext): Prim[] => {
  const s = screenOf(v, ctx);
  const fieldCols = Math.min(400, s.cols * 2);
  const fieldRows = rowsFor(fieldCols, ctx);
  const field = fieldOf(v, ctx, fieldCols, fieldRows);
  const lo = numOr(v.minSize, 0) / 100;
  const hi = numOr(v.maxSize, 100) / 100;
  const fade = edgeFadeOf(v, s.cols, s.rows);
  const dot = String(v.dot || "circle") as Dot;
  const out: Prim[] = [];
  for (const [x, y] of pointsOf(s, ctx)) {
    const t = sampleAt(
      field,
      fieldCols,
      fieldRows,
      x / ctx.width,
      y / ctx.height
    );
    const size = lo + (hi - lo) * t;
    const col = Math.floor((x / ctx.width) * s.cols);
    const row = Math.floor((y / ctx.height) * s.rows);
    const fill = fadeCell(fade, col, row, colourOf(v, ctx, t));
    if (fill && size > 0.02) {
      out.push(markOf(dot, x, y, size, s, fill));
    }
  }
  return out;
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0c2a2e");

export const halftoneTool: ImageTool = {
  blurb:
    "A screen of dots, squares, lines or crosses sized by a picture, text, waves, noise or a gradient, turned to any angle. Goes in as an SVG.",
  draw: (g, v, ctx) => drawPrims(g, marksOf(v, ctx), ctx, groundOf(v)),
  id: "halftone",
  kind: "image",
  looks: [
    { name: "Waves (Durves)", values: {} },
    {
      name: "Photo, 45° print screen",
      values: { angle: 45, columns: 90, maxSize: 115, source: "picture" },
    },
    {
      name: "Dot type",
      values: { columns: 70, maxSize: 95, minSize: 8, source: "text" },
    },
    {
      name: "Line screen from a gradient",
      values: {
        angle: 0,
        columns: 50,
        dot: "line",
        fieldAngle: 0,
        source: "gradient",
      },
    },
    {
      name: "Burst from the centre",
      values: {
        colour: "tones",
        columns: 46,
        dot: "diamond",
        source: "radial",
      },
    },
  ],
  name: "Halftone",
  params: [
    ...fieldParams(
      ["waves", "picture", "text", "noise", "gradient", "radial"],
      "waves"
    ),
    {
      default: "circle",
      key: "dot",
      label: "Mark",
      options: [
        { label: "Dots", value: "circle" },
        { label: "Squares", value: "square" },
        { label: "Diamonds", value: "diamond" },
        { label: "Lines", value: "line" },
        { label: "Crosses", value: "cross" },
      ],
      type: "select",
    },
    {
      default: 60,
      key: "columns",
      label: "Marks across",
      max: 220,
      min: 6,
      type: "range",
    },
    {
      default: 0,
      key: "angle",
      label: "Screen angle",
      max: 90,
      min: 0,
      type: "range",
    },
    {
      default: 0,
      key: "minSize",
      label: "Smallest mark (%)",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: 100,
      key: "maxSize",
      label: "Largest mark (%)",
      max: 150,
      min: 10,
      type: "range",
    },
    ...FADE_PARAMS,
    {
      default: "one",
      key: "colour",
      label: "Colour",
      options: [
        { label: "One colour", value: "one" },
        { label: "By tone (the colours below)", value: "tones" },
      ],
      type: "select",
    },
    {
      default: "#8fd6e8",
      key: "ink",
      label: "Marks",
      type: "color",
      when: (v) => v.colour !== "tones",
    },
    {
      count: 4,
      key: "colors",
      label: "Colours, light to strong",
      max: 8,
      type: "colors",
      when: (v) => v.colour === "tones",
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
  render: (v, ctx) => primsDoc(marksOf(v, ctx), ctx, groundOf(v)),
  vector: true,
};
