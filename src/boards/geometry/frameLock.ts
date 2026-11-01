import { withinFrame } from "../../../config/graph.js";
import type { BoardItem } from "../../types";
import type { Selection } from "./selectionModel";

/**
 * Design frames on the canvas: a frame holding a design is one object. What's
 * on it is clipped to its edges and can't be picked out on its own; pressing
 * it picks up the frame, and the layers are edited in the frame editor.
 *
 * Only design frames. A frame holding nodes (an `op` or a shader) is a group
 * of a workflow: its nodes have to stay clickable to be run, wired and
 * prompted, so it keeps the old behaviour — nothing clipped, everything free.
 *
 * Membership is the board's usual rule (centre inside, see withinFrame), so an
 * item dragged onto a design frame joins it and is clipped from then on.
 */

export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface FrameLock {
  /** The bounds the item is drawn within: every design frame it sits in. */
  clip: Rect;
  /** The outermost design frame it sits in: what a press picks up. */
  owner: string;
}

const WORKFLOW_KINDS = new Set<BoardItem["kind"]>(["op", "shader"]);

/** A frame holding a design rather than a group of nodes. */
export const isDesignFrame = (frame: BoardItem, items: BoardItem[]): boolean =>
  frame.kind === "frame" &&
  !withinFrame(frame, items).some((item) => WORKFLOW_KINDS.has(item.kind));

const intersect = (a: Rect, b: Rect): Rect => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    x,
    y,
  };
};

const area = (r: Rect): number => r.width * r.height;

/** Every item sitting in a design frame, with its owner and clip. */
export const frameLocks = (items: BoardItem[]): Map<string, FrameLock> => {
  const locks = new Map<string, FrameLock>();
  const frames = items.filter((item) => isDesignFrame(item, items));
  for (const frame of frames) {
    for (const item of withinFrame(frame, items)) {
      const was = locks.get(item.id);
      if (!was) {
        locks.set(item.id, { clip: frame, owner: frame.id });
        continue;
      }
      const owner = items.find((i) => i.id === was.owner);
      locks.set(item.id, {
        clip: intersect(was.clip, frame),
        owner: owner && area(owner) >= area(frame) ? was.owner : frame.id,
      });
    }
  }
  // A frame inside another design frame is content too, so its owner is
  // whatever owns the outer one: one press, one object, however deep.
  // Two frames stacked exactly on each other each contain the other, so the
  // walk remembers where it has been.
  const outermost = (id: string, seen = new Set<string>()): string => {
    const hop = locks.get(id);
    if (!hop || seen.has(id)) {
      return id;
    }
    seen.add(id);
    return outermost(hop.owner, seen);
  };
  for (const [id, lock] of locks) {
    const owner = outermost(lock.owner);
    if (owner !== lock.owner) {
      locks.set(id, { ...lock, owner });
    }
  }
  return locks;
};

/**
 * The selection with anything inside a design frame swapped for that frame.
 * Hands back the same set when nothing changed, so it can run in an effect.
 */
export const liftToFrames = (
  selection: Selection,
  locks: Map<string, FrameLock>
): Selection => {
  if (![...selection].some((id) => locks.has(id))) {
    return selection;
  }
  return new Set([...selection].map((id) => locks.get(id)?.owner ?? id));
};

/**
 * The clip as a CSS polygon in the item's own box, which is turned about its
 * centre when the item is rotated, so the frame's edges stay put on screen.
 * Null when the item sits wholly inside the frame and needs no clip.
 */
export const clipPathFor = (item: BoardItem, clip: Rect): string | null => {
  const inside =
    item.x >= clip.x &&
    item.y >= clip.y &&
    item.x + item.width <= clip.x + clip.width &&
    item.y + item.height <= clip.y + clip.height;
  if (inside && !item.rotation) {
    return null;
  }
  const angle = (-(item.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  const corners = [
    [clip.x, clip.y],
    [clip.x + clip.width, clip.y],
    [clip.x + clip.width, clip.y + clip.height],
    [clip.x, clip.y + clip.height],
  ];
  const points = corners.map(([px = 0, py = 0]) => {
    const dx = px - cx;
    const dy = py - cy;
    const x = dx * cos - dy * sin + item.width / 2;
    const y = dx * sin + dy * cos + item.height / 2;
    return `${Math.round(x * 100) / 100}px ${Math.round(y * 100) / 100}px`;
  });
  return `polygon(${points.join(", ")})`;
};
