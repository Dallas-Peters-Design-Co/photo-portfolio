import { pick } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numOr } from "./cellField";
import { fieldOf, fieldParams } from "./field";
import { drawPrims, type Prim, primsDoc } from "./prims";
import { hex, rgb } from "./recolour";

/**
 * Iso Blocks: text, a picture or noise built as stacks of isometric cubes,
 * taller where the source is strongest. Built, not drawn: assets stack up.
 * Vector.
 */

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

interface Setup {
  cols: number;
  levels: number;
  ox: number;
  oy: number;
  rows: number;
  u: number;
}

const setupOf = (v: StudioValues, ctx: RenderContext): Setup => {
  const cols = Math.max(4, Math.round(numOr(v.columns, 64)));
  const rows = Math.max(2, Math.round((cols * numOr(v.depth, 36)) / 100));
  const levels = Math.max(1, Math.round(numOr(v.levels, 3)));
  // Fitted: the whole build, its height included, inside the piece.
  const wide = (cols + rows) * COS;
  const tall = (cols + rows) * SIN + levels;
  const u =
    Math.min((ctx.width * 0.92) / wide, (ctx.height * 0.9) / tall) *
    (numOr(v.zoom, 100) / 100);
  return {
    cols,
    levels,
    ox: ctx.width / 2 - ((cols - rows) * COS * u) / 2,
    oy: (ctx.height - tall * u) / 2 + levels * u,
    rows,
    u,
  };
};

/** A ground point (c, r) at height z, on screen. */
const at = (s: Setup, c: number, r: number, z: number): [number, number] => [
  s.ox + (c - r) * COS * s.u,
  s.oy + (c + r) * SIN * s.u - z * s.u,
];

const shade = (colour: string, k: number): string => {
  const [r, g, b] = rgb(colour);
  return hex(r * k, g * k, b * k);
};

const faces = (
  s: Setup,
  c: number,
  r: number,
  z0: number,
  z1: number,
  colour: string,
  v: StudioValues
): Prim[] => {
  const dark = 1 - numOr(v.shading, 35) / 100;
  const line = v.edges === true ? String(v.edgeColour || "#00000055") : null;
  const sw = s.u * 0.04;
  const p = (cc: number, rr: number, z: number) => at(s, cc, rr, z);
  const quad = (pts: [number, number][], fill: string): Prim => ({
    fill,
    pts: pts.flat(),
    stroke: line,
    sw,
    t: "poly",
  });
  return [
    // Left face (along the row's front edge), then right, then the top.
    quad(
      [
        p(c, r + 1, z0),
        p(c + 1, r + 1, z0),
        p(c + 1, r + 1, z1),
        p(c, r + 1, z1),
      ],
      shade(colour, (1 + dark) / 2)
    ),
    quad(
      [
        p(c + 1, r, z0),
        p(c + 1, r + 1, z0),
        p(c + 1, r + 1, z1),
        p(c + 1, r, z1),
      ],
      shade(colour, dark)
    ),
    quad(
      [p(c, r, z1), p(c + 1, r, z1), p(c + 1, r + 1, z1), p(c, r + 1, z1)],
      colour
    ),
  ];
};

const colourOf = (
  v: StudioValues,
  ctx: RenderContext,
  c: number,
  cols: number,
  h: number,
  levels: number
) => {
  if (v.colour === "height") {
    return pick(
      ctx.palette,
      Math.min(
        ctx.palette.length - 1,
        Math.floor(((h - 1) / Math.max(1, levels)) * ctx.palette.length)
      )
    );
  }
  if (v.colour === "across") {
    return pick(ctx.palette, Math.floor((c / cols) * ctx.palette.length));
  }
  return pick(ctx.palette, 0);
};

const heightsOf = (v: StudioValues, ctx: RenderContext, s: Setup): number[] => {
  const field = fieldOf(v, ctx, s.cols, s.rows);
  const cut = numOr(v.threshold, 35) / 100;
  const flat = v.flat === true;
  return Array.from(field, (t) => {
    if (t <= cut) {
      return 0;
    }
    return flat
      ? s.levels
      : Math.max(1, Math.ceil(((t - cut) / (1 - cut)) * s.levels));
  });
};

const blocksOf = (v: StudioValues, ctx: RenderContext): Prim[] => {
  const s = setupOf(v, ctx);
  const heights = heightsOf(v, ctx, s);
  const stacked = v.stacked !== false;
  const out: Prim[] = [];
  // Back to front: by c + r, so nearer columns are drawn over farther ones.
  for (let sum = 0; sum <= s.cols + s.rows - 2; sum += 1) {
    for (
      let r = Math.max(0, sum - s.cols + 1);
      r <= Math.min(s.rows - 1, sum);
      r += 1
    ) {
      const c = sum - r;
      const h = heights[r * s.cols + c] ?? 0;
      if (h === 0) {
        continue;
      }
      const colour = colourOf(v, ctx, c, s.cols, h, s.levels);
      if (stacked) {
        for (let z = 0; z < h; z += 1) {
          out.push(...faces(s, c, r, z, z + 1, colour, v));
        }
      } else {
        out.push(...faces(s, c, r, 0, h, colour, v));
      }
    }
  }
  return out;
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0c2a2e");

export const isoBlocksTool: ImageTool = {
  blurb:
    "Text, a picture or noise built as stacks of isometric cubes, taller where it's strongest. Goes in as an SVG.",
  draw: (g, v, ctx) => drawPrims(g, blocksOf(v, ctx), ctx, groundOf(v)),
  id: "iso-blocks",
  kind: "image",
  looks: [
    { name: "Built type", values: { colour: "across" } },
    {
      name: "Skyline from noise",
      values: {
        columns: 30,
        depth: 100,
        flat: false,
        levels: 8,
        source: "noise",
        threshold: 20,
      },
    },
    {
      name: "Flat blocks, colour across",
      values: { colour: "across", levels: 1, stacked: false },
    },
    {
      name: "Picture in relief",
      values: {
        columns: 56,
        depth: 70,
        flat: false,
        levels: 6,
        source: "picture",
        threshold: 10,
      },
    },
  ],
  name: "Iso Blocks",
  params: [
    ...fieldParams(
      ["text", "picture", "noise", "waves", "radial"],
      "text",
      "2027"
    ),
    {
      default: 64,
      key: "columns",
      label: "Blocks across",
      max: 120,
      min: 4,
      type: "range",
    },
    {
      default: 36,
      key: "depth",
      label: "Blocks deep (% of across)",
      max: 150,
      min: 5,
      type: "range",
    },
    {
      default: 3,
      key: "levels",
      label: "Tallest stack",
      max: 16,
      min: 1,
      type: "range",
    },
    {
      default: 35,
      key: "threshold",
      label: "Leave out below (%)",
      max: 95,
      min: 0,
      type: "range",
    },
    {
      default: true,
      key: "flat",
      label: "All the same height",
      type: "checkbox",
    },
    {
      default: true,
      key: "stacked",
      label: "Show each cube",
      type: "checkbox",
    },
    {
      default: 100,
      key: "zoom",
      label: "Size",
      max: 200,
      min: 30,
      type: "range",
    },
    {
      default: 35,
      key: "shading",
      label: "Shading",
      max: 80,
      min: 0,
      type: "range",
    },
    {
      default: "across",
      key: "colour",
      label: "Colour by",
      options: [
        { label: "Height", value: "height" },
        { label: "Across", value: "across" },
        { label: "One colour", value: "one" },
      ],
      type: "select",
    },
    { count: 4, key: "colors", label: "Colours", max: 8, type: "colors" },
    {
      default: false,
      key: "edges",
      label: "Outline the cubes",
      type: "checkbox",
    },
    {
      default: "#00000055",
      key: "edgeColour",
      label: "Outline",
      type: "color",
      when: (v) => v.edges === true,
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
  render: (v, ctx) => primsDoc(blocksOf(v, ctx), ctx, groundOf(v)),
  vector: true,
};
