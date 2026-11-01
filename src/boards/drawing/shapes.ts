import type { DrawingConfig, DrawTool, Point } from "./drawing";

/**
 * The shapes beyond rectangles and ellipses, after tldraw: triangle, polygon,
 * star, squircle, and lines with or without an arrowhead.
 *
 * Each is an SVG path for a box of the item's size, so the board (SVG), the
 * PNG export (Path2D takes the same string) and the HTML5 export all draw the
 * same outline from one place. Closed shapes are inset by half the stroke so
 * the outline sits inside the box, as the rectangle does. A line keeps its two
 * ends in unit space (config.points), so it can point any way and still
 * stretch with its box.
 */

export const PATH_TOOLS = [
  "triangle",
  "polygon",
  "star",
  "squircle",
  "line",
  "arrow",
] as const;

export type PathTool = (typeof PATH_TOOLS)[number];

export const isPathTool = (tool: DrawTool | string | undefined): boolean =>
  PATH_TOOLS.includes(tool as PathTool);

export const isLineTool = (tool: DrawTool | string | undefined): boolean =>
  tool === "line" || tool === "arrow";

export interface ShapeGeometry {
  /** False for lines: nothing to fill. */
  closed: boolean;
  d: string;
  /** The arrowhead, filled in the stroke colour. */
  head?: string;
}

const n = (v: number) => Math.round(v * 100) / 100;
const path = (pts: Point[], close = true) =>
  `${pts.map((p, i) => `${i === 0 ? "M" : "L"}${n(p.x)} ${n(p.y)}`).join(" ")}${close ? " Z" : ""}`;

/** Points on the ellipse that fills the box, from the top, clockwise. */
const ring = (
  count: number,
  w: number,
  h: number,
  inset: number,
  radiusAt: (i: number) => number
): Point[] => {
  const rx = Math.max(w / 2 - inset, 0);
  const ry = Math.max(h / 2 - inset, 0);
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
    const r = radiusAt(i);
    return { x: w / 2 + Math.cos(a) * rx * r, y: h / 2 + Math.sin(a) * ry * r };
  });
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : fallback;

/** A superellipse (|x|^4 + |y|^4 = 1): a square with continuous corners. */
const squircle = (w: number, h: number, inset: number): string => {
  const rx = Math.max(w / 2 - inset, 0);
  const ry = Math.max(h / 2 - inset, 0);
  const steps = 72;
  const pts = Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return {
      x: w / 2 + Math.sign(c) * Math.abs(c) ** 0.5 * rx,
      y: h / 2 + Math.sign(s) * Math.abs(s) ** 0.5 * ry,
    };
  });
  return path(pts);
};

const lineGeometry = (
  config: DrawingConfig,
  w: number,
  h: number,
  stroke: number
): ShapeGeometry => {
  const [a = { x: 0, y: 0.5 }, b = { x: 1, y: 0.5 }] = config.points ?? [];
  const start = { x: a.x * w, y: a.y * h };
  const end = { x: b.x * w, y: b.y * h };
  if (config.tool !== "arrow") {
    return { closed: false, d: path([start, end], false) };
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // The head grows with the line weight, and never past half the line.
  const size = Math.min(Math.max(stroke * 3.5, 12), len / 2);
  const base = { x: end.x - ux * size, y: end.y - uy * size };
  const half = size * 0.55;
  const head = path([
    end,
    { x: base.x - uy * half, y: base.y + ux * half },
    { x: base.x + uy * half, y: base.y - ux * half },
  ]);
  // The shaft stops inside the head, so its round cap doesn't poke out the tip.
  const shaftEnd = { x: base.x + ux * size * 0.3, y: base.y + uy * size * 0.3 };
  return { closed: false, d: path([start, shaftEnd], false), head };
};

/**
 * The outline of a path shape at w × h, for a stroke of the given width (in the
 * same units). Null for tools this module doesn't draw.
 */
export const shapeGeometry = (
  config: DrawingConfig,
  w: number,
  h: number,
  stroke: number
): ShapeGeometry | null => {
  const inset = stroke / 2;
  switch (config.tool) {
    case "triangle":
      return {
        closed: true,
        d: path([
          { x: w / 2, y: inset },
          { x: w - inset, y: h - inset },
          { x: inset, y: h - inset },
        ]),
      };
    case "polygon":
      return {
        closed: true,
        d: path(ring(clampInt(config.sides, 3, 12, 6), w, h, inset, () => 1)),
      };
    case "star": {
      const points = clampInt(config.sides, 3, 24, 5);
      const inner =
        typeof config.innerRatio === "number"
          ? Math.min(0.95, Math.max(0.1, config.innerRatio))
          : 0.45;
      return {
        closed: true,
        d: path(ring(points * 2, w, h, inset, (i) => (i % 2 ? inner : 1))),
      };
    }
    case "squircle":
      return { closed: true, d: squircle(w, h, inset) };
    case "line":
    case "arrow":
      return lineGeometry(config, w, h, stroke);
    default:
      return null;
  }
};
