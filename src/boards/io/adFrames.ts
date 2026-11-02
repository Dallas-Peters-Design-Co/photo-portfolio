import {
  type AdSize,
  frameBoxFor,
  relayout,
  sizeTitle,
} from "../../../config/adLayout";
import {
  CANVAS_WIDTH,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from "../../../config/canvas";
import { containedBy, withinFrame } from "../../../config/graph";
import type { BoardItem } from "../../types";
import { findFreeSpot } from "../geometry/placement";
import { newItemId } from "./newItemId";

/**
 * Resizing a frame to an ad size, or copying it out at several.
 *
 * The geometry is config/adLayout.ts; this is the board side: which items are
 * the design (the frame's own contents, by centre), where copies go, and what
 * a copy carries. Pure, so the editor hook is just change() and a toast.
 */

const GAP = 120;

const layoutOf = (item: BoardItem) => ({ ...item });

const fit = (
  frame: BoardItem,
  next: { height: number; width: number; x: number; y: number },
  inside: BoardItem[]
) =>
  relayout(
    frame,
    next,
    inside.map(layoutOf),
    {},
    {
      maxFont: MAX_FONT_SIZE,
      minFont: MIN_FONT_SIZE,
      minSize: 8,
    }
  );

/** The frame resized to one size, its contents laid out again inside it. */
export const resizeFrame = (
  items: BoardItem[],
  frameId: string,
  size: AdSize
): BoardItem[] | null => {
  const frame = items.find((item) => item.id === frameId);
  if (frame?.kind !== "frame") {
    return null;
  }
  const box = { ...frameBoxFor(size, frame), x: frame.x, y: frame.y };
  const placed = new Map(
    fit(frame, box, containedBy(frame, items)).map((item) => [item.id, item])
  );
  return items.map((item) => {
    if (item.id === frame.id) {
      return { ...item, ...box, body: sizeTitle(size) };
    }
    return placed.get(item.id) ?? item;
  });
};

/**
 * Copies of the frame at each size, laid out in a row to its right, wrapping
 * under it when the row would run off the canvas. The original is untouched.
 */
export const copyFrameAtSizes = (
  items: BoardItem[],
  frameId: string,
  sizes: AdSize[]
): { added: BoardItem[]; frameIds: string[] } | null => {
  const frame = items.find((item) => item.id === frameId);
  if (frame?.kind !== "frame" || sizes.length === 0) {
    return null;
  }
  const inside = containedBy(frame, items);
  const top = Math.max(0, ...items.map((item) => item.z ?? 0)) + 1;
  const added: BoardItem[] = [];
  const frameIds: string[] = [];
  const {
    height: frameHeight,
    width: frameWidth,
    x: left,
    y: frameTop,
  } = frame;
  let x = left + frameWidth + GAP;
  let y = frameTop;
  let rowHeight = frameHeight;

  sizes.forEach((size, index) => {
    const box = frameBoxFor(size, frame);
    if (x + box.width > CANVAS_WIDTH) {
      x = left;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    const next = { ...box, x, y };
    const id = newItemId();
    frameIds.push(id);
    // The frame goes under its contents: frames sit at the back already, so
    // the copy keeps the original's z and the contents stack above it.
    added.push({ ...frame, ...next, body: sizeTitle(size), id });
    fit(frame, next, inside).forEach((item, i) => {
      added.push({
        ...item,
        id: newItemId(),
        recipeUseId: null,
        z: top + index * inside.length + i,
      });
    });
    x += box.width + GAP;
    rowHeight = Math.max(rowHeight, box.height);
  });
  return { added, frameIds };
};

/**
 * An exact copy of the frame and everything on it (frames inside it too), at
 * the nearest clear spot to its right. Same size, same title, same design;
 * the copies stack above everything so none of them hides under the board.
 * Other frames count as taken, so the copy can't land on one and join it.
 */
export const duplicateFrame = (
  items: BoardItem[],
  frameId: string
): { added: BoardItem[]; frameId: string } | null => {
  const frame = items.find((item) => item.id === frameId);
  if (frame?.kind !== "frame") {
    return null;
  }
  const inside = withinFrame(frame, items);
  const obstacles = items.map((i) =>
    i.kind === "frame" ? { ...i, kind: "drawing" as const } : i
  );
  const spot = findFreeSpot({
    height: frame.height,
    items: obstacles,
    origin: {
      x: frame.x + frame.width * 1.5 + GAP,
      y: frame.y + frame.height / 2,
    },
    width: frame.width,
  });
  const dx = spot.x - frame.x;
  const dy = spot.y - frame.y;
  const top = Math.max(0, ...items.map((item) => item.z ?? 0)) + 1;
  const id = newItemId();
  // Back to front, so the copies keep the original's stacking order.
  const ordered = [...inside].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const added: BoardItem[] = [
    { ...frame, id, recipeUseId: null, x: frame.x + dx, y: frame.y + dy },
    ...ordered.map((item, i) => ({
      ...item,
      id: newItemId(),
      recipeUseId: null,
      x: item.x + dx,
      y: item.y + dy,
      z: item.kind === "frame" ? item.z : top + i,
    })),
  ];
  return { added, frameId: id };
};
