import type { Box } from "./creativeModel";

/**
 * Snapping a moving box to the artboard and to the other layers.
 *
 * Each axis is tried on its own: the box's start, centre and end against every
 * target line (the frame's edges and centre, and each other layer's edges and
 * centre). The closest match within the threshold wins, and the line it
 * matched is returned so the editor can draw it as a guide.
 */

export interface Guides {
  x: number[];
  y: number[];
}

const linesOf = (box: Box, axis: "x" | "y"): number[] =>
  axis === "x"
    ? [box.x, box.x + box.width / 2, box.x + box.width]
    : [box.y, box.y + box.height / 2, box.y + box.height];

const bestShift = (
  moving: number[],
  targets: number[],
  threshold: number
): { line: number | null; shift: number } => {
  let best: { line: number | null; shift: number } = { line: null, shift: 0 };
  let bestDistance = threshold;
  for (const from of moving) {
    for (const to of targets) {
      const distance = Math.abs(to - from);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { line: to, shift: to - from };
      }
    }
  }
  return best;
};

/**
 * ⌘ (Ctrl elsewhere) held mid-drag places freely, without snapping. Not ⌥:
 * that duplicates, as in Figma and Illustrator.
 */
export const skipsSnap = (e: { ctrlKey: boolean; metaKey: boolean }) =>
  e.metaKey || e.ctrlKey;

/** Where a dragged box should land, and which guide lines it touched. */
export const snapMove = (
  box: Box,
  frame: Box,
  others: Box[],
  threshold: number
): { box: Box; guides: Guides } => {
  const targetsX = [frame, ...others].flatMap((b) => linesOf(b, "x"));
  const targetsY = [frame, ...others].flatMap((b) => linesOf(b, "y"));
  const sx = bestShift(linesOf(box, "x"), targetsX, threshold);
  const sy = bestShift(linesOf(box, "y"), targetsY, threshold);
  return {
    box: { ...box, x: box.x + sx.shift, y: box.y + sy.shift },
    guides: {
      x: sx.line === null ? [] : [sx.line],
      y: sy.line === null ? [] : [sy.line],
    },
  };
};

/**
 * Snapping one moving edge while resizing: only that edge is tried, so the
 * opposite side stays exactly where the handle left it.
 */
export const snapEdge = (
  value: number,
  axis: "x" | "y",
  frame: Box,
  others: Box[],
  threshold: number
): { line: number | null; value: number } => {
  const targets = [frame, ...others].flatMap((b) => linesOf(b, axis));
  const { line, shift } = bestShift([value], targets, threshold);
  return { line, value: value + shift };
};
