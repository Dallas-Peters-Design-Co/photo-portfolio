import { r2 } from "../rng";
import type { RenderContext, StudioParam, StudioValues } from "../types";

/**
 * Grid lines over a tile grid (Mosaic, Systems Flow): thin lines between the
 * tiles in place of the gap, and crosshairs where they meet, a little longer
 * and heavier than the lines. Drawn over the tiles, in the SVG and the
 * preview alike.
 */

export const GRID_PARAMS: StudioParam[] = [
  {
    default: false,
    key: "lines",
    label: "Grid lines instead of a gap",
    type: "checkbox",
  },
  {
    default: false,
    key: "crosses",
    label: "Crosshairs where the lines meet",
    type: "checkbox",
  },
  {
    default: "#ffffff33",
    key: "lineColour",
    label: "Line colour",
    type: "color",
    when: (v) => v.lines === true,
  },
  {
    default: 2,
    key: "lineWidth",
    label: "Line weight",
    max: 12,
    min: 1,
    type: "range",
    when: (v) => v.lines === true || v.crosses === true,
  },
  {
    default: "#ffffffaa",
    key: "crossColour",
    label: "Crosshair colour",
    type: "color",
    when: (v) => v.crosses === true,
  },
  {
    default: 18,
    key: "crossSize",
    label: "Crosshair size",
    max: 50,
    min: 4,
    type: "range",
    when: (v) => v.crosses === true,
  },
];

/** The tile grid: Mosaic and Systems Flow both size it from `columns`. */
export interface Grid {
  cell: number;
  cols: number;
  rows: number;
}

export const gridFrom = (cols: number, ctx: RenderContext): Grid => {
  const cell = ctx.width / cols;
  return { cell, cols, rows: Math.max(1, Math.round(ctx.height / cell)) };
};

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const colourOr = (value: unknown, fallback: string) =>
  typeof value === "string" && HEX.test(value) ? value : fallback;

interface Look {
  cross: { colour: string; size: number; weight: number } | null;
  line: { colour: string; weight: number } | null;
}

/** What to draw, or null for neither. */
export const linesLook = (v: StudioValues): Look | null => {
  const weight = Math.max(1, Number(v.lineWidth) || 2);
  const look: Look = {
    // The crosshairs a touch heavier than the lines, so they read.
    cross:
      v.crosses === true
        ? {
            colour: colourOr(v.crossColour, "#ffffffaa"),
            size: Math.max(4, Number(v.crossSize) || 18) / 100,
            weight: weight * 1.5,
          }
        : null,
    line:
      v.lines === true
        ? { colour: colourOr(v.lineColour, "#ffffff33"), weight }
        : null,
  };
  return look.cross || look.line ? look : null;
};

/** Where the lines run: between the tiles, not round the outside. */
const positions = (g: Grid) => ({
  xs: Array.from({ length: g.cols - 1 }, (_, i) => (i + 1) * g.cell),
  ys: Array.from({ length: g.rows - 1 }, (_, i) => (i + 1) * g.cell),
});

const strokeOf = (colour: string, weight: number): string => {
  const alpha =
    colour.length === 9 ? Number.parseInt(colour.slice(7, 9), 16) / 255 : 1;
  const opacity = alpha < 0.998 ? ` stroke-opacity="${r2(alpha)}"` : "";
  return `fill="none" stroke="${colour.slice(0, 7)}" stroke-width="${r2(weight)}"${opacity}`;
};

/** The lines and crosshairs as SVG, to go over the tiles. */
export const gridSvg = (
  g: Grid,
  look: Look | null,
  ctx: RenderContext
): string => {
  if (!look) {
    return "";
  }
  const { xs, ys } = positions(g);
  const parts: string[] = [];
  if (look.line) {
    const d = [
      ...xs.map((x) => `M${r2(x)} 0V${r2(ctx.height)}`),
      ...ys.map((y) => `M0 ${r2(y)}H${r2(ctx.width)}`),
    ].join("");
    parts.push(
      `<path d="${d}" ${strokeOf(look.line.colour, look.line.weight)}/>`
    );
  }
  if (look.cross) {
    const arm = g.cell * look.cross.size;
    const d = xs
      .flatMap((x) =>
        ys.map(
          (y) =>
            `M${r2(x - arm)} ${r2(y)}H${r2(x + arm)}M${r2(x)} ${r2(y - arm)}V${r2(y + arm)}`
        )
      )
      .join("");
    parts.push(
      `<path d="${d}" ${strokeOf(look.cross.colour, look.cross.weight)}/>`
    );
  }
  return parts.join("");
};

/** The same, drawn onto the preview canvas over the tiles. */
export const drawGrid = (
  c: CanvasRenderingContext2D,
  g: Grid,
  look: Look | null,
  ctx: RenderContext
) => {
  if (!look) {
    return;
  }
  const { xs, ys } = positions(g);
  c.save();
  c.scale(c.canvas.width / ctx.width, c.canvas.height / ctx.height);
  if (look.line) {
    c.strokeStyle = look.line.colour;
    c.lineWidth = look.line.weight;
    c.beginPath();
    for (const x of xs) {
      c.moveTo(x, 0);
      c.lineTo(x, ctx.height);
    }
    for (const y of ys) {
      c.moveTo(0, y);
      c.lineTo(ctx.width, y);
    }
    c.stroke();
  }
  if (look.cross) {
    const arm = g.cell * look.cross.size;
    c.strokeStyle = look.cross.colour;
    c.lineWidth = look.cross.weight;
    c.beginPath();
    for (const x of xs) {
      for (const y of ys) {
        c.moveTo(x - arm, y);
        c.lineTo(x + arm, y);
        c.moveTo(x, y - arm);
        c.lineTo(x, y + arm);
      }
    }
    c.stroke();
  }
  c.restore();
};
