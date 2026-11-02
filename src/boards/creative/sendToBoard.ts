import type { BoardItem } from "../../types";
import { clearSpotRightOf } from "../geometry/placement";
import type { Box } from "./creativeModel";

/**
 * Layers taken off a design frame and put back on the board: the same items,
 * moved to the nearest clear spot beside the frame, keeping their layout
 * relative to each other. A layer belongs to whichever frame its centre sits
 * in, so moving it out is all it takes for it to be a loose item again.
 *
 * Every item counts as in the way, frames included: landing on this frame
 * would put the layers straight back in it, and landing on another would hand
 * them to that one (clearSpotRightOf).
 */

const unionOf = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    x,
    y,
  };
};

/** Where each layer goes: a patch of x and y per id. */
export const sendToBoard = (
  group: BoardItem[],
  frame: Box,
  items: BoardItem[]
): Map<string, Partial<BoardItem>> => {
  if (group.length === 0) {
    return new Map();
  }
  const moving = new Set(group.map((l) => l.id));
  const union = unionOf(group);
  // Beside the frame, on the row the layers were on, past whatever is there.
  const spot = clearSpotRightOf({ ...frame, y: union.y }, items, union, moving);
  const dx = spot.x - union.x;
  const dy = spot.y - union.y;
  return new Map(
    group.map((l) => [
      l.id,
      { x: Math.round(l.x + dx), y: Math.round(l.y + dy) },
    ])
  );
};
