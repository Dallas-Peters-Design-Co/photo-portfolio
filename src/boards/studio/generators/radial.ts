import { pick, r2, rng } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numOr } from "./cellField";
import { faded } from "./mosaicFeather";
import { drawPrims, type Prim, primsDoc } from "./prims";

/**
 * Radial: patterns about a centre — rings, a sunburst of wedges, spokes,
 * dots on rings, and petals turned in a rosette. The centre can sit
 * anywhere, even off the piece, for a burst rising from an edge. Vector.
 */

interface Setup {
  cx: number;
  cy: number;
  inner: number;
  n: number;
  outer: number;
  twist: number;
}

const setupOf = (v: StudioValues, ctx: RenderContext): Setup => {
  const cx = (numOr(v.cx, 50) / 100) * ctx.width;
  const cy = (numOr(v.cy, 50) / 100) * ctx.height;
  // Out to the farthest corner, so the pattern always fills the piece.
  const outer = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(ctx.width - cx, cy),
    Math.hypot(cx, ctx.height - cy),
    Math.hypot(ctx.width - cx, ctx.height - cy)
  );
  return {
    cx,
    cy,
    inner: (numOr(v.inner, 0) / 100) * outer,
    n: Math.max(2, Math.round(numOr(v.count, 24))),
    outer,
    twist: (numOr(v.twist, 0) * Math.PI) / 180,
  };
};

/** A colour for the n-th band, fading outward by `falloff`. */
const colourAt = (
  v: StudioValues,
  ctx: RenderContext,
  i: number,
  t: number
) => {
  const base = pick(ctx.palette, i);
  const k = 1 - (numOr(v.falloff, 0) / 100) * t;
  return faded(base, Math.max(0, k));
};

const wedge = (s: Setup, a0: number, a1: number, fill: string): Prim => ({
  fill,
  pts: [
    s.cx + Math.cos(a0) * s.inner,
    s.cy + Math.sin(a0) * s.inner,
    s.cx + Math.cos(a0) * s.outer * 1.05,
    s.cy + Math.sin(a0) * s.outer * 1.05,
    s.cx + Math.cos(a1) * s.outer * 1.05,
    s.cy + Math.sin(a1) * s.outer * 1.05,
    s.cx + Math.cos(a1) * s.inner,
    s.cy + Math.sin(a1) * s.inner,
  ],
  t: "poly",
});

const rings = (v: StudioValues, ctx: RenderContext, s: Setup): Prim[] => {
  const out: Prim[] = [];
  const step = (s.outer - s.inner) / s.n;
  // Largest first, so each smaller disc sits on the one before.
  for (let i = s.n - 1; i >= 0; i -= 1) {
    out.push({
      fill: colourAt(v, ctx, i, i / s.n),
      r: s.inner + step * (i + 1),
      t: "circle",
      x: s.cx,
      y: s.cy,
    });
  }
  return out;
};

const burst = (v: StudioValues, ctx: RenderContext, s: Setup): Prim[] => {
  const out: Prim[] = [];
  const share = numOr(v.width, 50) / 100;
  const each = (Math.PI * 2) / s.n;
  for (let i = 0; i < s.n; i += 1) {
    const a0 = s.twist + i * each;
    out.push(wedge(s, a0, a0 + each * share, colourAt(v, ctx, i, 0)));
  }
  return out;
};

const spokes = (v: StudioValues, ctx: RenderContext, s: Setup): Prim[] => {
  const out: Prim[] = [];
  const each = (Math.PI * 2) / s.n;
  const sw = numOr(v.stroke, 3);
  for (let i = 0; i < s.n; i += 1) {
    const a = s.twist + i * each;
    out.push({
      d: `M${r2(s.cx + Math.cos(a) * s.inner)} ${r2(s.cy + Math.sin(a) * s.inner)}L${r2(s.cx + Math.cos(a) * s.outer)} ${r2(s.cy + Math.sin(a) * s.outer)}`,
      stroke: colourAt(v, ctx, i, 0),
      sw,
      t: "path",
    });
  }
  return out;
};

const dots = (v: StudioValues, ctx: RenderContext, s: Setup): Prim[] => {
  const out: Prim[] = [];
  const ringsN = Math.max(2, Math.round(numOr(v.rings, 12)));
  const step = (s.outer - s.inner) / ringsN;
  const jitter = rng(Number(v.seed) || 1);
  for (let k = 1; k <= ringsN; k += 1) {
    const r = s.inner + step * k;
    const each = (Math.PI * 2) / s.n;
    const size = (step * numOr(v.width, 50)) / 200;
    for (let i = 0; i < s.n; i += 1) {
      const a =
        i * each + s.twist * k + (v.scatter === true ? jitter() * each : 0);
      out.push({
        fill: colourAt(v, ctx, k + i, k / ringsN),
        r: size * (v.grow === false ? 1 : 0.3 + (0.7 * k) / ringsN),
        t: "circle",
        x: s.cx + Math.cos(a) * r,
        y: s.cy + Math.sin(a) * r,
      });
    }
  }
  return out;
};

const petals = (v: StudioValues, ctx: RenderContext, s: Setup): Prim[] => {
  const out: Prim[] = [];
  const ringsN = Math.max(1, Math.round(numOr(v.rings, 6)));
  for (let k = ringsN; k >= 1; k -= 1) {
    const len = s.inner + ((s.outer * 0.9 - s.inner) * k) / ringsN;
    const wide = len * (numOr(v.width, 50) / 200);
    const each = (Math.PI * 2) / s.n;
    for (let i = 0; i < s.n; i += 1) {
      const a = i * each + s.twist * k + (k % 2 ? each / 2 : 0);
      const mid = len * 0.55;
      const pt = (dist: number, turn: number) =>
        `${r2(s.cx + Math.cos(a) * dist + Math.cos(a + turn) * (turn ? wide : 0))} ${r2(s.cy + Math.sin(a) * dist + Math.sin(a + turn) * (turn ? wide : 0))}`;
      const centre = `${r2(s.cx)} ${r2(s.cy)}`;
      out.push({
        d: `M${centre}Q${pt(mid, -Math.PI / 2)} ${pt(len, 0)}Q${pt(mid, Math.PI / 2)} ${centre}Z`,
        fill: colourAt(v, ctx, k, k / ringsN),
        t: "path",
      });
    }
  }
  return out;
};

const MODES: Record<
  string,
  (v: StudioValues, ctx: RenderContext, s: Setup) => Prim[]
> = {
  burst,
  dots,
  petals,
  rings,
  spokes,
};

const shapesOf = (v: StudioValues, ctx: RenderContext): Prim[] =>
  (MODES[String(v.mode)] ?? burst)(v, ctx, setupOf(v, ctx));

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0c2a2e");

const isMode =
  (...modes: string[]) =>
  (v: StudioValues) =>
    modes.includes(String(v.mode || "burst"));

export const radialTool: ImageTool = {
  blurb:
    "Patterns about a centre: rings, a sunburst, spokes, dots on rings or a rosette of petals; the centre can sit off the edge. Goes in as an SVG.",
  draw: (g, v, ctx) => drawPrims(g, shapesOf(v, ctx), ctx, groundOf(v)),
  id: "radial",
  kind: "image",
  looks: [
    { name: "Sunburst", values: {} },
    {
      name: "Rising from the bottom edge",
      values: { count: 36, cy: 120, falloff: 60, width: 40 },
    },
    { name: "Target rings", values: { count: 9, mode: "rings" } },
    {
      name: "Dot rings",
      values: { count: 48, mode: "dots", rings: 14, twist: 6 },
    },
    {
      name: "Rosette",
      values: { count: 12, mode: "petals", rings: 5, twist: 8, width: 60 },
    },
  ],
  name: "Radial",
  params: [
    {
      default: "burst",
      key: "mode",
      label: "Pattern",
      options: [
        { label: "Sunburst", value: "burst" },
        { label: "Rings", value: "rings" },
        { label: "Spokes", value: "spokes" },
        { label: "Dots on rings", value: "dots" },
        { label: "Petals", value: "petals" },
      ],
      type: "select",
    },
    {
      default: 24,
      key: "count",
      label: "How many",
      max: 180,
      min: 2,
      type: "range",
    },
    {
      default: 8,
      key: "rings",
      label: "Rings",
      max: 40,
      min: 1,
      type: "range",
      when: isMode("dots", "petals"),
    },
    {
      default: 50,
      key: "width",
      label: "Width (%)",
      max: 100,
      min: 5,
      type: "range",
      when: isMode("burst", "dots", "petals"),
    },
    {
      default: 3,
      key: "stroke",
      label: "Line weight",
      max: 40,
      min: 0.5,
      step: 0.5,
      type: "range",
      when: isMode("spokes"),
    },
    {
      default: 0,
      key: "twist",
      label: "Twist (°)",
      max: 90,
      min: -90,
      type: "range",
    },
    {
      default: 0,
      key: "inner",
      label: "Hole in the middle (%)",
      max: 80,
      min: 0,
      type: "range",
    },
    {
      default: 50,
      key: "cx",
      label: "Centre across (%)",
      max: 150,
      min: -50,
      type: "range",
    },
    {
      default: 50,
      key: "cy",
      label: "Centre down (%)",
      max: 150,
      min: -50,
      type: "range",
    },
    {
      default: 0,
      key: "falloff",
      label: "Fade outward",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: false,
      key: "scatter",
      label: "Scatter the dots",
      type: "checkbox",
      when: isMode("dots"),
    },
    {
      default: true,
      key: "grow",
      label: "Dots grow outward",
      type: "checkbox",
      when: isMode("dots"),
    },
    {
      count: 2,
      key: "colors",
      label: "Colours (alternate)",
      max: 8,
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
  render: (v, ctx) => primsDoc(shapesOf(v, ctx), ctx, groundOf(v)),
  vector: true,
};
