import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../../config/canvas.js";
import type { BoardItem } from "../../types";

/**
 * Where to put something new.
 *
 * The old rule — near the middle of the canvas, nudged by a counter — put items
 * on top of each other the moment a board had anything in it, because the
 * counter only tracked how many items existed and not where any of them were.
 * This looks instead.
 *
 * A frame is not an obstacle. Frames exist to have things placed on them, so
 * treating one as occupied would push every new item outside the group it
 * belongs to.
 */

/** Space left between a placed item and its neighbours, in canvas units. */
const GUTTER = 32;

/** How far the search walks before giving up and stacking anyway. */
const MAX_RINGS = 24;

interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width + GUTTER &&
  a.x + a.width + GUTTER > b.x &&
  a.y < b.y + b.height + GUTTER &&
  a.y + a.height + GUTTER > b.y;

const withinCanvas = (box: Box): boolean =>
  box.x >= 0 &&
  box.y >= 0 &&
  box.x + box.width <= CANVAS_WIDTH &&
  box.y + box.height <= CANVAS_HEIGHT;

export interface PlacementOptions {
  height: number;
  items: BoardItem[];
  /** Where to search outward from — usually the middle of what is on screen. */
  origin: { x: number; y: number };
  width: number;
}

/**
 * The first free spot at or near `origin`.
 *
 * Searches in widening rings rather than scanning the whole canvas: a new item
 * should land where you are looking, and the nearest gap to that point is
 * almost always the right answer. Falls back to the origin when a board is
 * dense enough that nothing is free — stacking is better than refusing to
 * insert, and the item can be dragged.
 */
export const findFreeSpot = ({
  height,
  items,
  origin,
  width,
}: PlacementOptions): { x: number; y: number } => {
  const obstacles = items
    .filter((item) => item.kind !== "frame")
    .map((item) => ({
      height: item.height,
      width: item.width,
      x: item.x,
      y: item.y,
    }));

  const start = {
    x: Math.round(origin.x - width / 2),
    y: Math.round(origin.y - height / 2),
  };

  const step = Math.max(width, height) / 2 + GUTTER;

  for (let ring = 0; ring < MAX_RINGS; ring += 1) {
    // Ring 0 is the origin itself; after that, walk the perimeter of a square
    // of side 2·ring so the nearest gaps are tried before the far ones.
    const offsets: { dx: number; dy: number }[] =
      ring === 0 ? [{ dx: 0, dy: 0 }] : [];
    for (let i = -ring; i <= ring && ring > 0; i += 1) {
      offsets.push(
        { dx: i, dy: -ring },
        { dx: i, dy: ring },
        { dx: -ring, dy: i },
        { dx: ring, dy: i }
      );
    }

    for (const { dx, dy } of offsets) {
      const candidate = {
        height,
        width,
        x: start.x + dx * step,
        y: start.y + dy * step,
      };
      if (
        withinCanvas(candidate) &&
        !obstacles.some((obstacle) => overlaps(candidate, obstacle))
      ) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  return start;
};

/**
 * The first clear spot to the right of `box`, on the same row, for something
 * the same size: past whatever is in the way, as far as it takes.
 *
 * For copies of frames and for layers sent back to the board. findFreeSpot
 * keeps to the canvas and, when nothing inside it is free, falls back to
 * stacking; poster-sized frames rarely fit there, so a copy landed squarely
 * on its neighbour. Here the walk goes right until it is clear, and every
 * item counts as in the way, frames included.
 */
export const clearSpotRightOf = (
  box: Box,
  items: BoardItem[],
  size: { height: number; width: number } = box,
  ignore: ReadonlySet<string> = new Set(),
  gap = 120
): { x: number; y: number } => {
  const others = items.filter((item) => !ignore.has(item.id));
  let x = box.x + box.width + gap;
  for (let guard = 0; guard < 500; guard += 1) {
    const candidate = { height: size.height, width: size.width, x, y: box.y };
    const hit = others.find((item) => overlaps(candidate, item));
    if (!hit) {
      return { x: Math.round(x), y: Math.round(box.y) };
    }
    x = hit.x + hit.width + gap;
  }
  return { x: Math.round(x), y: Math.round(box.y) };
};
