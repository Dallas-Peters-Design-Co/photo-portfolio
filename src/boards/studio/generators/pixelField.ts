import { r2 } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numOr } from "./cellField";
import { edgeFadeOf, FADE_PARAMS, fadeCell } from "./edgeFade";
import { fieldOf, fieldParams, rowsFor } from "./field";
import { drawPrims, type Prim, primsDoc } from "./prims";
import { hex, rgb } from "./recolour";

/**
 * Pixel Field: a coarse grid of big cells coloured from a soft source
 * (blobs, a gradient, noise, a picture, text) through a colour ramp, each
 * cell solid or drawn as a texture: vertical or horizontal line screens,
 * dots or wavy lines. The low-resolution heat-map poster (Jacqueline Casey's
 * MIT posters, data-driven identity work). Vector.
 */

type Style = "dots" | "hlines" | "solid" | "vlines" | "waves";

/** A value 0–1 through the ramp of colours, low to high. */
const ramp = (stops: string[], t: number, steps: number): string => {
  const n = stops.length;
  if (n === 0) {
    return "#ffffff";
  }
  const q = steps > 1 ? Math.round(t * (steps - 1)) / (steps - 1) : t;
  const at = Math.max(0, Math.min(1, q)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(at));
  if (n === 1) {
    return stops[0] ?? "#ffffff";
  }
  const [r1, g1, b1] = rgb(stops[i] ?? "#000000");
  const [r2b, g2, b2] = rgb(stops[i + 1] ?? "#ffffff");
  const k = at - i;
  return hex(r1 + (r2b - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
};

interface Cell {
  colour: string;
  h: number;
  t: number;
  w: number;
  x: number;
  y: number;
}

/** A cell's texture: n lines or dots inside it, weighted by its value. */
const texture = (cell: Cell, v: StudioValues, style: Style): Prim[] => {
  const n = Math.max(1, Math.round(numOr(v.density, 6)));
  const fill = numOr(v.ink, 60) / 100;
  const k = v.weightByValue === false ? fill : fill * (0.25 + 0.75 * cell.t);
  const { colour: c, h, w, x, y } = cell;
  const out: Prim[] = [];
  if (style === "vlines" || style === "hlines") {
    const along = style === "vlines" ? w : h;
    const pitch = along / n;
    for (let i = 0; i < n; i += 1) {
      const t = pitch * k;
      const a = i * pitch + (pitch - t) / 2;
      const pts =
        style === "vlines"
          ? [x + a, y, x + a + t, y, x + a + t, y + h, x + a, y + h]
          : [x, y + a, x + w, y + a, x + w, y + a + t, x, y + a + t];
      out.push({ fill: c, pts, t: "poly" });
    }
    return out;
  }
  if (style === "dots") {
    const pitch = w / n;
    const rows = Math.max(1, Math.round(h / pitch));
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < n; i += 1) {
        out.push({
          fill: c,
          r: (pitch / 2) * k,
          t: "circle",
          x: x + pitch * (i + 0.5),
          y: y + (h / rows) * (j + 0.5),
        });
      }
    }
    return out;
  }
  // Wavy lines, a little restless: the amplitude follows the value.
  const pitch = h / n;
  const amp = pitch * 0.45 * cell.t;
  for (let i = 0; i < n; i += 1) {
    const base = y + pitch * (i + 0.5);
    let d = `M${r2(x)} ${r2(base)}`;
    for (let s = 1; s <= 8; s += 1) {
      d += `L${r2(x + (w * s) / 8)} ${r2(base + Math.sin(s * 1.9 + i) * amp)}`;
    }
    out.push({ d, stroke: c, sw: pitch * k * 0.6, t: "path" });
  }
  return out;
};

const shapesOf = (v: StudioValues, ctx: RenderContext): Prim[] => {
  const cols = Math.max(2, Math.round(numOr(v.columns, 18)));
  const rows =
    v.cellShape === "tall"
      ? Math.max(1, Math.round(rowsFor(cols, ctx) / 2))
      : rowsFor(cols, ctx);
  const field = fieldOf(v, ctx, cols, rows);
  const fade = edgeFadeOf(v, cols, rows);
  const style = String(v.style || "vlines") as Style;
  const steps = Math.round(numOr(v.steps, 0));
  const cut = numOr(v.cutoff, 0) / 100;
  const gap = numOr(v.gap, 0);
  const w = ctx.width / cols;
  const h = ctx.height / rows;
  const out: Prim[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const t = field[r * cols + c] ?? 0;
      const colour =
        t < cut ? null : fadeCell(fade, c, r, ramp(ctx.palette, t, steps));
      if (!colour) {
        continue;
      }
      const cell = {
        colour,
        h: h - gap,
        t,
        w: w - gap,
        x: c * w + gap / 2,
        y: r * h + gap / 2,
      };
      if (style === "solid") {
        out.push({
          fill: colour,
          pts: [
            cell.x,
            cell.y,
            cell.x + cell.w,
            cell.y,
            cell.x + cell.w,
            cell.y + cell.h,
            cell.x,
            cell.y + cell.h,
          ],
          t: "poly",
        });
      } else {
        out.push(...texture(cell, v, style));
      }
    }
  }
  return out;
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0a0a0a");

export const pixelFieldTool: ImageTool = {
  blurb:
    "Big cells coloured from soft blobs, a gradient, noise, a picture or text through a colour ramp, solid or as line screens, dots or wavy lines. The low-res heat-map poster. Goes in as an SVG.",
  draw: (g, v, ctx) => drawPrims(g, shapesOf(v, ctx), ctx, groundOf(v)),
  id: "pixel-field",
  kind: "image",
  looks: [
    { name: "Heat map in a line screen", values: {} },
    {
      name: "Corner gradient, solid cells",
      values: {
        bg: "#f6f7f2",
        columns: 12,
        fieldX: 100,
        fieldY: 0,
        source: "radial",
        style: "solid",
      },
    },
    {
      name: "Rising bars",
      values: {
        columns: 30,
        fieldAngle: 270,
        source: "gradient",
        style: "vlines",
      },
    },
    {
      name: "Dot heat map",
      values: { columns: 24, density: 3, style: "dots" },
    },
    {
      name: "Two-colour pixels",
      values: {
        columns: 28,
        cutoff: 50,
        source: "noise",
        steps: 2,
        style: "solid",
      },
    },
  ],
  name: "Pixel Field",
  params: [
    ...fieldParams(
      ["blobs", "gradient", "radial", "noise", "picture", "text", "waves"],
      "blobs"
    ),
    {
      default: 18,
      key: "columns",
      label: "Cells across",
      max: 160,
      min: 2,
      type: "range",
    },
    {
      default: "square",
      key: "cellShape",
      label: "Cells",
      options: [
        { label: "Square", value: "square" },
        { label: "Tall (twice as high)", value: "tall" },
      ],
      type: "select",
    },
    {
      default: "vlines",
      key: "style",
      label: "Each cell is",
      options: [
        { label: "Vertical line screen", value: "vlines" },
        { label: "Horizontal lines", value: "hlines" },
        { label: "Solid", value: "solid" },
        { label: "Dots", value: "dots" },
        { label: "Wavy lines", value: "waves" },
      ],
      type: "select",
    },
    {
      default: 6,
      key: "density",
      label: "Lines or dots per cell",
      max: 24,
      min: 1,
      type: "range",
      when: (v) => v.style !== "solid",
    },
    {
      default: 60,
      key: "ink",
      label: "Line / dot weight (%)",
      max: 100,
      min: 5,
      type: "range",
      when: (v) => v.style !== "solid",
    },
    {
      default: true,
      key: "weightByValue",
      label: "Heavier where it's stronger",
      type: "checkbox",
      when: (v) => v.style !== "solid",
    },
    {
      default: 0,
      key: "steps",
      label: "Colour steps (0 = smooth)",
      max: 12,
      min: 0,
      type: "range",
    },
    {
      default: 0,
      key: "cutoff",
      label: "Leave empty below (%)",
      max: 95,
      min: 0,
      type: "range",
    },
    {
      default: 0,
      key: "gap",
      label: "Gap between cells",
      max: 40,
      min: 0,
      type: "range",
    },
    ...FADE_PARAMS,
    {
      count: 4,
      key: "colors",
      label: "Colour ramp, low to high",
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
      default: "#0a0a0a",
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
