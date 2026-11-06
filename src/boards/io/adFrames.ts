import {
  type AdSize,
  DEFAULT_UNITS_PER_PX,
  frameBoxFor,
  relayout,
  sizeFromTitle,
  sizeTitle,
} from "../../../config/adLayout";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../../../config/canvas";
import { containedBy, withinFrame } from "../../../config/graph";
import type { BoardItem } from "../../types";
import { clearSpotRightOf } from "../geometry/placement";
import { newItemId } from "./newItemId";

/**
 * Resizing a frame to an ad size, or copying it out at several.
 *
 * The geometry is config/adLayout.ts; this is the board side: which items are
 * the design (the frame's own contents, by centre), where copies go, and what
 * a copy carries. Pure, so the editor hook is just change() and a toast.
 */

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
 * Copies of the frame at each size, laid out in a row to its right, each past
 * anything in the way. The original is untouched.
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
  // Each copy goes to the first clear spot right of the one before, past
  // anything already there: placing by arithmetic alone put copies straight
  // on top of the next frame along.
  let after: { height: number; width: number; x: number; y: number } = frame;

  sizes.forEach((size, index) => {
    const box = frameBoxFor(size, frame);
    const spot = clearSpotRightOf(after, [...items, ...added], box);
    const next = { ...box, x: spot.x, y: spot.y };
    after = next;
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
  });
  return { added, frameIds };
};

/**
 * An exact copy of the frame and everything on it (frames inside it too), at
 * the first clear spot to its right on the same row, however far that is. Same size, same title, same design;
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
  const spot = clearSpotRightOf(frame, items);
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

/** A config's lengths (in canvas units) at a new scale. */
const scaledConfig = (
  config: BoardItem["config"],
  k: number
): BoardItem["config"] => {
  if (!config) {
    return config;
  }
  const out = { ...config };
  for (const key of ["strokeWidth", "radius"]) {
    if (typeof out[key] === "number") {
      out[key] = Math.round((out[key] as number) * k * 100) / 100;
    }
  }
  return out;
};

/**
 * How much a frame would scale to sit at the standard board size for its
 * named size (half its print pixels), or null when it has no named size or
 * already does.
 */
export const scaleResetOf = (frame: BoardItem): number | null => {
  const size = sizeFromTitle(frame.body);
  if (!size || frame.width <= 0) {
    return null;
  }
  const k = (size.w * DEFAULT_UNITS_PER_PX) / frame.width;
  return Math.abs(k - 1) < 0.001 ? null : k;
};

/**
 * The frame and everything on it (frames inside it too) scaled together to
 * the standard board size for its named size, about its top-left corner.
 * What it prints doesn't change: the print size comes from the name. What
 * changes is that type and lengths now match every other frame of that size,
 * so copying between them keeps sizes.
 */
export const resetFrameScale = (
  items: BoardItem[],
  frameId: string
): BoardItem[] | null => {
  const frame = items.find((item) => item.id === frameId);
  const k = frame?.kind === "frame" ? scaleResetOf(frame) : null;
  if (!(frame && k)) {
    return null;
  }
  const moving = new Set([
    frame.id,
    ...withinFrame(frame, items).map((item) => item.id),
  ]);
  const at = (v: number) => Math.round(v * k * 100) / 100;
  return items.map((item) =>
    moving.has(item.id)
      ? {
          ...item,
          config: scaledConfig(item.config, k),
          fontSize: item.fontSize === null ? null : at(item.fontSize),
          height: at(item.height),
          width: at(item.width),
          x: frame.x + at(item.x - frame.x),
          y: frame.y + at(item.y - frame.y),
        }
      : item
  );
};
