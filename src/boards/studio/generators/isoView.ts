import type { Prim } from "./prims";
import { hex, rgb } from "./recolour";

/**
 * Seeing a grid of stacked cubes from any side: turned about the vertical
 * (0–360°) and tilted from level (low) to straight down (90°). Classic
 * isometric is a 45° turn at about a 35° tilt. Orthographic, so cubes keep
 * their size; drawn back to front, with faces nobody can see left out.
 */

export interface View {
  cols: number;
  cp: number;
  /** cos and sin of the turn and the tilt. */
  ct: number;
  rows: number;
  scale: number;
  sp: number;
  st: number;
  x0: number;
  y0: number;
}

/** A point of the build (plan x, plan y, height), turned and tilted. */
const turned = (v: View, x: number, y: number, z: number) => {
  const px = x - v.cols / 2;
  const py = y - v.rows / 2;
  const x1 = px * v.ct - py * v.st;
  const y1 = px * v.st + py * v.ct;
  return { depth: y1 * v.cp + z * v.sp, sx: x1, sy: y1 * v.sp - z * v.cp };
};

/** On screen. */
export const project = (
  v: View,
  x: number,
  y: number,
  z: number
): [number, number] => {
  const p = turned(v, x, y, z);
  return [v.x0 + p.sx * v.scale, v.y0 + p.sy * v.scale];
};

/** How near the viewer a point is (larger is nearer). */
export const depthOf = (v: View, x: number, y: number, z: number): number =>
  turned(v, x, y, z).depth;

/**
 * A view fitted to the piece: the whole build, every column at its tallest,
 * inside `w` × `h` with a margin, scaled by `zoom`.
 */
export const viewFor = (
  w: number,
  h: number,
  cols: number,
  rows: number,
  levels: number,
  turnDeg: number,
  tiltDeg: number,
  zoom: number
): View => {
  const t = (turnDeg * Math.PI) / 180;
  const p = (Math.max(5, Math.min(90, tiltDeg)) * Math.PI) / 180;
  const v: View = {
    cols,
    cp: Math.cos(p),
    ct: Math.cos(t),
    rows,
    scale: 1,
    sp: Math.sin(p),
    st: Math.sin(t),
    x0: 0,
    y0: 0,
  };
  let [minX, minY, maxX, maxY] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const [x, y] of [
    [0, 0],
    [cols, 0],
    [0, rows],
    [cols, rows],
  ]) {
    for (const z of [0, levels]) {
      const q = turned(v, x ?? 0, y ?? 0, z);
      minX = Math.min(minX, q.sx);
      maxX = Math.max(maxX, q.sx);
      minY = Math.min(minY, q.sy);
      maxY = Math.max(maxY, q.sy);
    }
  }
  const scale =
    Math.min(
      (w * 0.92) / Math.max(1e-6, maxX - minX),
      (h * 0.9) / Math.max(1e-6, maxY - minY)
    ) * zoom;
  return {
    ...v,
    scale,
    x0: w / 2 - ((minX + maxX) / 2) * scale,
    y0: h / 2 - ((minY + maxY) / 2) * scale,
  };
};

const shade = (colour: string, k: number): string => {
  const [r, g, b] = rgb(colour);
  return hex(r * k, g * k, b * k);
};

/**
 * The four sides of a cell: the outward step in the plan, and the side's
 * two ground corners relative to the cell's corner.
 */
const SIDES: [number, number, number, number, number, number][] = [
  [1, 0, 1, 0, 1, 1],
  [-1, 0, 0, 0, 0, 1],
  [0, 1, 0, 1, 1, 1],
  [0, -1, 0, 0, 1, 0],
];

/** The sides of one cube showing at levels z0–z1. */
const sidesOf = (
  v: View,
  c: number,
  r: number,
  z0: number,
  z1: number,
  heightAt: (c: number, r: number) => number,
  colour: string,
  look: Look,
  quad: (pts: [number, number, number][], fill: string) => Prim
): Prim[] => {
  const out: Prim[] = [];
  // Straight down, sides have no height on screen.
  if (v.cp < 1e-3) {
    return out;
  }
  for (const [dx, dy, ax, ay, bx, by] of SIDES) {
    // Facing the viewer when the outward step, turned, points toward them;
    // buried when the neighbour that way stands at least as tall.
    const toward = dx * v.st + dy * v.ct;
    if (toward <= 1e-6 || heightAt(c + dx, r + dy) >= z1) {
      continue;
    }
    const sideX = dx * v.ct - dy * v.st;
    const k = look.dark + (1 - look.dark) * (0.5 - 0.5 * sideX);
    const [x0, y0, x1, y1] = [c + ax, r + ay, c + bx, r + by];
    out.push(
      quad(
        [
          [x0, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y0, z1],
        ],
        shade(colour, k)
      )
    );
  }
  return out;
};

export interface Look {
  dark: number;
  edge: string | null;
}

/**
 * One cell's column, cube by cube from `from` to `to` (or as one prism when
 * `stacked` is off), showing only faces turned toward the viewer and not
 * buried against a neighbour at least as tall.
 */
export const columnFaces = (
  v: View,
  c: number,
  r: number,
  heightAt: (c: number, r: number) => number,
  colour: string,
  look: Look,
  stacked: boolean
): Prim[] => {
  const h = heightAt(c, r);
  const out: Prim[] = [];
  const steps = stacked
    ? Array.from({ length: h }, (_, z) => [z, z + 1])
    : [[0, h]];
  const sw = v.scale * 0.04;
  const quad = (pts: [number, number, number][], fill: string): Prim => ({
    fill,
    pts: pts.flatMap(([x, y, z]) => project(v, x, y, z)),
    stroke: look.edge,
    sw,
    t: "poly",
  });
  for (const [z0 = 0, z1 = 1] of steps) {
    out.push(...sidesOf(v, c, r, z0, z1, heightAt, colour, look, quad));
    if (z1 === h) {
      out.push(
        quad(
          [
            [c, r, z1],
            [c + 1, r, z1],
            [c + 1, r + 1, z1],
            [c, r + 1, z1],
          ],
          colour
        )
      );
    }
  }
  return out;
};
