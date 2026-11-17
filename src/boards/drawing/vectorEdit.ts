import type { BoardItem } from "../../types";
import { newItemId } from "../io/newItemId";
import type { DrawingConfig } from "./drawing";

/**
 * Editing a vector shape (text converted to outlines, textOutlines.ts)
 * without a bezier editor: fit its box to the letters, or split it into one
 * layer per letter to move them about.
 *
 * Its path is absolute M L Q C Z commands, as type outlines are written, in
 * the units of the box it was drawn in (viewWidth × viewHeight); the layer
 * draws it scaled to its own size (shapes.ts scalePath).
 */

interface Box {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

const COMMAND = /([MLQCZ])([^MLQCZ]*)/gi;
const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
const SUBPATH = /(?=M)/i;
/** Points along each curve sampled for its bounds: plenty at type sizes. */
const CURVE_STEPS = 8;

const round = (n: number) => Math.round(n * 100) / 100;

/** Point on a quadratic or cubic curve at t, for its bounds. */
const along = (pts: number[][], t: number): number[] => {
  let level = pts;
  while (level.length > 1) {
    level = level.slice(1).map((p, i) => {
      const q = level[i] as number[];
      return [
        (q[0] as number) + ((p[0] as number) - (q[0] as number)) * t,
        (q[1] as number) + ((p[1] as number) - (q[1] as number)) * t,
      ];
    });
  }
  return level[0] as number[];
};

/** Samples each curve of `per` pairs into `out`; returns where it ends. */
const sampleCurves = (
  out: number[][],
  from: number[],
  pairs: number[][],
  per: number
): number[] => {
  let at = from;
  for (let i = 0; i + per <= pairs.length; i += per) {
    const curve = [at, ...pairs.slice(i, i + per)];
    for (let s = 1; s <= CURVE_STEPS; s += 1) {
      out.push(along(curve, s / CURVE_STEPS));
    }
    at = curve.at(-1) as number[];
  }
  return at;
};

/** The points a path passes through, curves sampled. */
const pointsOf = (d: string): number[][] => {
  const out: number[][] = [];
  let at = [0, 0];
  for (const [, cmd = "", args = ""] of d.matchAll(COMMAND)) {
    const n = (args.match(NUMBER) ?? []).map(Number);
    const pairs: number[][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      pairs.push([n[i] as number, n[i + 1] as number]);
    }
    const c = cmd.toUpperCase();
    if (c === "M" || c === "L") {
      out.push(...pairs);
      at = pairs.at(-1) ?? at;
    } else if (c === "Q" || c === "C") {
      at = sampleCurves(out, at, pairs, c === "Q" ? 2 : 3);
    }
  }
  return out;
};

export const pathBounds = (d: string): Box | null => {
  const pts = pointsOf(d);
  if (pts.length === 0) {
    return null;
  }
  const xs = pts.map((p) => p[0] as number);
  const ys = pts.map((p) => p[1] as number);
  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
};

/** The path moved by (dx, dy): every number alternates x then y. */
const shift = (d: string, dx: number, dy: number): string => {
  let i = 0;
  return d.replace(NUMBER, (value) => {
    const moved = Number(value) + (i % 2 === 0 ? dx : dy);
    i += 1;
    return String(round(moved));
  });
};

export const isVectorShape = (item: BoardItem): boolean => {
  const config = item.config as DrawingConfig | null;
  return (
    item.kind === "drawing" &&
    config?.tool === "vector" &&
    typeof config.d === "string"
  );
};

/** A vector layer drawn from part of its path: the layer cut to that part. */
const layerFor = (
  item: BoardItem,
  d: string,
  box: Box,
  id: string
): BoardItem => {
  const config = item.config as unknown as DrawingConfig;
  const sx = item.width / (config.viewWidth || item.width);
  const sy = item.height / (config.viewHeight || item.height);
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  return {
    ...item,
    config: {
      ...item.config,
      d: shift(d, -box.minX, -box.minY),
      viewHeight: round(h),
      viewWidth: round(w),
    },
    height: round(h * sy),
    id,
    width: round(w * sx),
    x: round(item.x + box.minX * sx),
    y: round(item.y + box.minY * sy),
  };
};

/** The layer with its box drawn tight round the letters, which stay put. */
export const fitVectorBox = (item: BoardItem): BoardItem => {
  const d = (item.config as DrawingConfig | null)?.d ?? "";
  const box = pathBounds(d);
  return box && isVectorShape(item) ? layerFor(item, d, box, item.id) : item;
};

const inside = (a: Box, b: Box): boolean =>
  a.minX >= b.minX && a.maxX <= b.maxX && a.minY >= b.minY && a.maxY <= b.maxY;

/**
 * The shape as one layer per letter, in place. Each closed outline is a
 * piece; an outline lying wholly inside another (the hole in an "o" or
 * "e") stays with it, so the letter keeps its counter. Separate parts of a
 * letter, like the dot of an "i", become pieces of their own.
 */
export const ungroupVector = (item: BoardItem): BoardItem[] => {
  const d = (item.config as DrawingConfig | null)?.d ?? "";
  if (!isVectorShape(item)) {
    return [item];
  }
  const parts = d
    .split(SUBPATH)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ box: pathBounds(p), d: p }))
    .filter((p): p is { box: Box; d: string } => p.box !== null);
  const outers = parts.filter(
    (p) => !parts.some((q) => q !== p && inside(p.box, q.box))
  );
  if (outers.length < 2) {
    return [item];
  }
  return outers.map((outer, i) => {
    const holes = parts.filter((p) => p !== outer && inside(p.box, outer.box));
    const pieceD = [outer.d, ...holes.map((h) => h.d)].join("");
    return layerFor(item, pieceD, outer.box, i === 0 ? item.id : newItemId());
  });
};
