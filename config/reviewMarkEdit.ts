import type { ReviewMark } from "./review.js";

/**
 * Editing a mark after it is drawn: moving it whole, or moving one of its
 * ends. Points are fractions of the picture, like everywhere else in a
 * review, and an edit never pushes a mark off the picture.
 *
 * Shared by the review editor and the board's Browser node
 * (src/components/review/MarkEditLayer.tsx).
 */

type Point = [number, number];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The points a mark can be reshaped by: an arrow's tail and tip, a box's or
 * highlight's two corners. A pen stroke has none; it only moves whole.
 */
export const handleIndexes = (mark: ReviewMark): number[] =>
  mark.kind === "pen" || mark.points.length < 2
    ? []
    : [0, mark.points.length - 1];

/** The mark with one point moved to `to`. */
export const movePoint = (
  mark: ReviewMark,
  index: number,
  to: { x: number; y: number }
): ReviewMark => ({
  ...mark,
  points: mark.points.map(
    (p, i): Point => (i === index ? [clamp01(to.x), clamp01(to.y)] : p)
  ),
});

/**
 * The mark moved by (dx, dy), held back at the picture's edge so it keeps its
 * shape rather than squashing against it.
 */
export const moveMark = (
  mark: ReviewMark,
  dx: number,
  dy: number
): ReviewMark => {
  const xs = mark.points.map(([x]) => x);
  const ys = mark.points.map(([, y]) => y);
  const sx = Math.min(Math.max(dx, -Math.min(...xs)), 1 - Math.max(...xs));
  const sy = Math.min(Math.max(dy, -Math.min(...ys)), 1 - Math.max(...ys));
  return {
    ...mark,
    points: mark.points.map(([x, y]): Point => [x + sx, y + sy]),
  };
};
