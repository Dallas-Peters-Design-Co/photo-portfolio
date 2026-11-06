import { pick } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numOr } from "./cellField";
import { fieldOf, fieldParams } from "./field";
import { columnFaces, depthOf, viewFor } from "./isoView";
import { drawPrims, type Prim, primsDoc } from "./prims";

/**
 * Iso Blocks: text, a picture or noise built as stacks of isometric cubes,
 * taller where the source is strongest. Built, not drawn: assets stack up.
 * Vector.
 */

interface Setup {
  cols: number;
  levels: number;
  rows: number;
}

const setupOf = (v: StudioValues): Setup => {
  const cols = Math.max(4, Math.round(numOr(v.columns, 64)));
  return {
    cols,
    levels: Math.max(1, Math.round(numOr(v.levels, 3))),
    rows: Math.max(2, Math.round((cols * numOr(v.depth, 36)) / 100)),
  };
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
  const s = setupOf(v);
  const heights = heightsOf(v, ctx, s);
  const view = viewFor(
    ctx.width,
    ctx.height,
    s.cols,
    s.rows,
    s.levels,
    numOr(v.turn, 45),
    numOr(v.tilt, 35),
    numOr(v.zoom, 100) / 100
  );
  const heightAt = (c: number, r: number) =>
    c < 0 || r < 0 || c >= s.cols || r >= s.rows
      ? 0
      : (heights[r * s.cols + c] ?? 0);
  const look = {
    dark: 1 - numOr(v.shading, 35) / 100,
    edge: v.edges === true ? String(v.edgeColour || "#00000055") : null,
  };
  // Back to front from wherever the viewer stands: farthest columns first.
  const cells: [number, number, number][] = [];
  for (let r = 0; r < s.rows; r += 1) {
    for (let c = 0; c < s.cols; c += 1) {
      if (heightAt(c, r) > 0) {
        cells.push([c, r, depthOf(view, c + 0.5, r + 0.5, 0)]);
      }
    }
  }
  cells.sort((a, b) => a[2] - b[2]);
  return cells.flatMap(([c, r]) =>
    columnFaces(
      view,
      c,
      r,
      heightAt,
      colourOf(v, ctx, c, s.cols, heightAt(c, r), s.levels),
      look,
      v.stacked !== false
    )
  );
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0c2a2e");

export const isoBlocksTool: ImageTool = {
  blurb:
    "Text, a picture or noise built as stacks of cubes, taller where it's strongest, seen from any turn and tilt. Goes in as an SVG.",
  draw: (g, v, ctx) => drawPrims(g, blocksOf(v, ctx), ctx, groundOf(v)),
  id: "iso-blocks",
  kind: "image",
  looks: [
    { name: "Built type", values: { colour: "across" } },
    {
      name: "Face on, from above",
      values: { colour: "across", tilt: 55, turn: 0 },
    },
    {
      name: "Low and turned",
      values: { colour: "across", tilt: 22, turn: 20 },
    },
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
      default: 45,
      key: "turn",
      label: "Turn (°)",
      max: 360,
      min: 0,
      type: "range",
    },
    {
      default: 35,
      key: "tilt",
      label: "Tilt: level to straight down (°)",
      max: 90,
      min: 5,
      type: "range",
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
