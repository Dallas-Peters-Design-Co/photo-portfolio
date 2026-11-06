import { r2, svgDoc } from "../rng";
import type { RenderContext } from "../types";
import { paintOf } from "./mosaicSvg";

/**
 * Simple shapes, drawn two ways: as an SVG (the file that goes on the board)
 * and straight onto the preview canvas, so a tool builds its picture once.
 * Colours may carry alpha (#rrggbbaa).
 */
export type Prim =
  | { fill: string; r: number; t: "circle"; x: number; y: number }
  | {
      fill?: string | null;
      pts: number[];
      stroke?: string | null;
      sw?: number;
      t: "poly";
    }
  | {
      d: string;
      fill?: string | null;
      stroke?: string | null;
      sw?: number;
      t: "path";
    };

const strokeOf = (colour: string | null | undefined, width = 1) => {
  if (!colour) {
    return "";
  }
  const paint = paintOf(colour);
  if (!paint) {
    return "";
  }
  return ` ${paint.replace("fill=", "stroke=").replace("fill-opacity=", "stroke-opacity=")} stroke-width="${r2(width)}" stroke-linejoin="round" stroke-linecap="round"`;
};

const fillOf = (colour: string | null | undefined) =>
  colour ? (paintOf(colour) ?? 'fill="none"') : 'fill="none"';

const primSvg = (p: Prim): string => {
  if (p.t === "circle") {
    const paint = paintOf(p.fill);
    return paint
      ? `<circle cx="${r2(p.x)}" cy="${r2(p.y)}" r="${r2(p.r)}" ${paint}/>`
      : "";
  }
  if (p.t === "poly") {
    return `<polygon points="${p.pts.map(r2).join(" ")}" ${fillOf(p.fill)}${strokeOf(p.stroke, p.sw)}/>`;
  }
  return `<path d="${p.d}" ${fillOf(p.fill)}${strokeOf(p.stroke, p.sw)}/>`;
};

/** The shapes as an SVG document, over a ground colour if there is one. */
export const primsDoc = (
  prims: Prim[],
  ctx: RenderContext,
  ground: string | null
): string => {
  const paint = ground ? paintOf(ground) : null;
  const back = paint
    ? `<rect width="${ctx.width}" height="${ctx.height}" ${paint}/>`
    : "";
  return svgDoc(ctx.width, ctx.height, back + prims.map(primSvg).join(""));
};

const tracePoly = (g: CanvasRenderingContext2D, pts: number[]) => {
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] ?? 0;
    const y = pts[i + 1] ?? 0;
    if (i === 0) {
      g.moveTo(x, y);
    } else {
      g.lineTo(x, y);
    }
  }
  g.closePath();
};

const paint = (
  g: CanvasRenderingContext2D,
  p: { fill?: string | null; stroke?: string | null; sw?: number },
  path?: Path2D
) => {
  if (p.fill) {
    g.fillStyle = p.fill;
    if (path) {
      g.fill(path);
    } else {
      g.fill();
    }
  }
  if (p.stroke) {
    g.strokeStyle = p.stroke;
    g.lineWidth = p.sw ?? 1;
    g.lineJoin = "round";
    g.lineCap = "round";
    if (path) {
      g.stroke(path);
    } else {
      g.stroke();
    }
  }
};

/** The same shapes on a canvas of any size (the preview). */
export const drawPrims = (
  g: CanvasRenderingContext2D,
  prims: Prim[],
  ctx: RenderContext,
  ground: string | null
) => {
  const { height, width } = g.canvas;
  g.save();
  g.clearRect(0, 0, width, height);
  g.scale(width / ctx.width, height / ctx.height);
  if (ground) {
    g.fillStyle = ground;
    g.fillRect(0, 0, ctx.width, ctx.height);
  }
  for (const p of prims) {
    if (p.t === "circle") {
      g.fillStyle = p.fill;
      g.beginPath();
      g.arc(p.x, p.y, Math.max(0, p.r), 0, Math.PI * 2);
      g.fill();
    } else if (p.t === "poly") {
      tracePoly(g, p.pts);
      paint(g, p);
    } else {
      paint(g, p, new Path2D(p.d));
    }
  }
  g.restore();
};
