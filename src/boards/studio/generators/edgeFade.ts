import type { StudioParam, StudioValues } from "../types";
import { faded, tileNoise } from "./mosaicFeather";

/**
 * Fading a pixel piece out toward one edge, without a mask: cells thin out
 * and dim the nearer they get to that edge, so the art dissolves into the
 * ground in its own pixels (and type set over that end sits on clear ground).
 */
export const FADE_PARAMS: StudioParam[] = [
  {
    default: "none",
    key: "fadeTo",
    label: "Fade out toward",
    options: [
      { label: "No fade", value: "none" },
      { label: "Bottom", value: "bottom" },
      { label: "Top", value: "top" },
      { label: "Left", value: "left" },
      { label: "Right", value: "right" },
    ],
    type: "select",
  },
  {
    default: 45,
    key: "fadeLength",
    label: "Fade length (% of the piece)",
    max: 100,
    min: 5,
    type: "range",
    when: (v) => fadeSide(v) !== null,
  },
  {
    default: 0,
    key: "fadeClear",
    label: "Clear band at the edge (%)",
    max: 60,
    min: 0,
    type: "range",
    when: (v) => fadeSide(v) !== null,
  },
];

type Side = "bottom" | "left" | "right" | "top";

const fadeSide = (v: StudioValues): Side | null => {
  const side = String(v.fadeTo ?? "none");
  return side === "bottom" ||
    side === "top" ||
    side === "left" ||
    side === "right"
    ? side
    : null;
};

/** How far a cell is from the faded edge, 0 at it to 1 at the far side. */
const fromEdge = (
  side: Side,
  col: number,
  row: number,
  cols: number,
  rows: number
): number => {
  const x = cols > 1 ? col / (cols - 1) : 0.5;
  const y = rows > 1 ? row / (rows - 1) : 0.5;
  if (side === "bottom") {
    return 1 - y;
  }
  if (side === "top") {
    return y;
  }
  return side === "right" ? 1 - x : x;
};

/**
 * A cell's strength under the fade, 0–1 (1 untouched), or null when there's
 * no fade. Smoothed, so the thinning starts gently.
 */
export const edgeFadeOf = (v: StudioValues, cols: number, rows: number) => {
  const side = fadeSide(v);
  if (!side) {
    return null;
  }
  const clear = Math.max(0, Number(v.fadeClear) || 0) / 100;
  const length = Math.max(0.01, (Number(v.fadeLength) || 45) / 100);
  return (col: number, row: number): number => {
    const d = (fromEdge(side, col, row, cols, rows) - clear) / length;
    const t = Math.max(0, Math.min(1, d));
    return t * t * (3 - 2 * t);
  };
};

/**
 * A cell's colour under the fade: gone (null) where the dissolve has thinned
 * it out, otherwise dimmed toward the edge. The same cells drop every redraw.
 */
export const fadeCell = (
  fade: ((col: number, row: number) => number) | null,
  col: number,
  row: number,
  colour: string
): string | null => {
  if (!fade) {
    return colour;
  }
  const k = fade(col, row);
  if (k <= 0 || (k < 1 && tileNoise(col + 13, row + 29) > k)) {
    return null;
  }
  return faded(colour, 0.45 + 0.55 * k);
};
