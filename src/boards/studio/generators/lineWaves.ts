import { pick, r2 } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numOr } from "./cellField";
import { fieldOf, fieldParams, rowsFor, sampleAt } from "./field";
import { drawPrims, type Prim, primsDoc } from "./prims";

/**
 * Line Waves: rows of lines across the piece, each lifted by a source (soft
 * noise, waves, text or a picture), so a word or a shape rises out of the
 * lines. Optionally each line hides the ones behind it, as on the cover of
 * Unknown Pleasures. Vector.
 */

interface Setup {
  amp: number;
  count: number;
  fieldCols: number;
  fieldRows: number;
  gap: number;
  steps: number;
  vertical: boolean;
}

const setupOf = (v: StudioValues, ctx: RenderContext): Setup => {
  const vertical = v.direction === "vertical";
  const count = Math.max(4, Math.round(numOr(v.lines, 60)));
  const across = vertical ? ctx.width : ctx.height;
  const gap = across / (count + 1);
  const fieldCols = 240;
  return {
    amp: numOr(v.amplitude, 6) * gap,
    count,
    fieldCols,
    fieldRows: rowsFor(fieldCols, ctx),
    gap,
    steps: Math.max(20, Math.round(numOr(v.detail, 160))),
    vertical,
  };
};

/** The points of one line, lifted by the field. */
const lineOf = (
  i: number,
  s: Setup,
  field: Float32Array,
  v: StudioValues,
  ctx: RenderContext
): number[] => {
  const along = s.vertical ? ctx.height : ctx.width;
  const base = s.gap * (i + 1);
  const taper = v.taper === true;
  const pts: number[] = [];
  for (let k = 0; k <= s.steps; k += 1) {
    const t = k / s.steps;
    const a = t * along;
    const u = s.vertical ? base / ctx.width : t;
    const w = s.vertical ? t : base / ctx.height;
    const env = taper ? Math.sin(Math.PI * t) ** 2 : 1;
    const lift = sampleAt(field, s.fieldCols, s.fieldRows, u, w) * s.amp * env;
    if (s.vertical) {
      pts.push(base + lift, a);
    } else {
      pts.push(a, base - lift);
    }
  }
  return pts;
};

const pathOf = (pts: number[]): string => {
  let d = "";
  for (let i = 0; i < pts.length; i += 2) {
    d += `${i === 0 ? "M" : "L"}${r2(pts[i] ?? 0)} ${r2(pts[i + 1] ?? 0)}`;
  }
  return d;
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0c2a2e");

const inkOf = (v: StudioValues, ctx: RenderContext, i: number, n: number) =>
  v.colour === "bands"
    ? pick(ctx.palette, Math.floor((i / n) * ctx.palette.length))
    : String(v.ink || "#f3e9a3");

const linesOf = (v: StudioValues, ctx: RenderContext): Prim[] => {
  const s = setupOf(v, ctx);
  const field = fieldOf(v, ctx, s.fieldCols, s.fieldRows);
  const sw = numOr(v.stroke, 2);
  const hide = v.hidden === true && !s.vertical;
  const ground = groundOf(v) ?? "#000000";
  const out: Prim[] = [];
  for (let i = 0; i < s.count; i += 1) {
    const pts = lineOf(i, s, field, v, ctx);
    const ink = inkOf(v, ctx, i, s.count);
    const d = pathOf(pts);
    if (hide) {
      // Closed down to the bottom and filled with the ground, so each line
      // hides the ones above it where it rises past them.
      out.push({
        d: `${d}L${ctx.width} ${ctx.height}L0 ${ctx.height}Z`,
        fill: ground,
        t: "path",
      });
    }
    out.push({ d, stroke: ink, sw, t: "path" });
  }
  return out;
};

export const lineWavesTool: ImageTool = {
  blurb:
    "Rows of lines lifted by noise, waves, text or a picture, so a word rises out of them; lines can hide the ones behind. Goes in as an SVG.",
  draw: (g, v, ctx) => drawPrims(g, linesOf(v, ctx), ctx, groundOf(v)),
  id: "line-waves",
  kind: "image",
  looks: [
    {
      name: "Ridges (hidden lines)",
      values: { amplitude: 10, contrast: 190, noiseSize: 16 },
    },
    {
      name: "Word rising out of lines",
      values: {
        amplitude: 3,
        hidden: true,
        lines: 70,
        source: "text",
        taper: false,
      },
    },
    {
      name: "Ripples",
      values: {
        amplitude: 2,
        hidden: false,
        lines: 46,
        source: "waves",
        taper: false,
      },
    },
    {
      name: "Brand bands",
      values: { colour: "bands", hidden: true, lines: 40, stroke: 4 },
    },
  ],
  name: "Line Waves",
  params: [
    ...fieldParams(["noise", "text", "waves", "picture", "radial"], "noise"),
    {
      default: 60,
      key: "lines",
      label: "Lines",
      max: 240,
      min: 4,
      type: "range",
    },
    {
      default: 6,
      key: "amplitude",
      label: "Height (in line gaps)",
      max: 30,
      min: 0,
      step: 0.5,
      type: "range",
    },
    {
      default: 2,
      key: "stroke",
      label: "Line weight",
      max: 16,
      min: 0.5,
      step: 0.5,
      type: "range",
    },
    {
      default: 160,
      key: "detail",
      label: "Smoothness",
      max: 600,
      min: 20,
      type: "range",
    },
    {
      default: "horizontal",
      key: "direction",
      label: "Lines run",
      options: [
        { label: "Across", value: "horizontal" },
        { label: "Down", value: "vertical" },
      ],
      type: "select",
    },
    {
      default: true,
      key: "hidden",
      label: "Lines hide the ones behind",
      type: "checkbox",
      when: (v) => v.direction !== "vertical",
    },
    {
      default: true,
      key: "taper",
      label: "Calm at the ends",
      type: "checkbox",
    },
    {
      default: "one",
      key: "colour",
      label: "Colour",
      options: [
        { label: "One colour", value: "one" },
        { label: "Bands (the colours below)", value: "bands" },
      ],
      type: "select",
    },
    {
      default: "#f3e9a3",
      key: "ink",
      label: "Lines",
      type: "color",
      when: (v) => v.colour !== "bands",
    },
    {
      count: 4,
      key: "colors",
      label: "Colours",
      max: 8,
      type: "colors",
      when: (v) => v.colour === "bands",
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
  render: (v, ctx) => primsDoc(linesOf(v, ctx), ctx, groundOf(v)),
  vector: true,
};
