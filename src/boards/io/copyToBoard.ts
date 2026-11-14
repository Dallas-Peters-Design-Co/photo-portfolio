import { containedBy } from "../../../config/graph.js";
import type { BoardItem, BoardWire } from "../../types";
import { newItemId } from "./newItemId";

/**
 * Frames and their contents, ready to be written to another board.
 *
 * Ids are reminted rather than carried across. Item ids are owned by the
 * client, and the upsert in api/boards/[id].ts is guarded by `board_id` — so an
 * item arriving on a new board under its existing id updates nothing and is
 * silently dropped. Reminting is also what makes this a copy: the original
 * keeps its ids, and editing one board cannot reach into the other.
 *
 * Wires are rewritten against the new ids, and only those with both endpoints
 * inside the frame survive — a wire to something left behind has nothing to
 * connect to. Results are not copied at all: `result` belongs to the run
 * endpoint and the board save cannot write it, so a generated node arrives on
 * the new board with its settings but without its generations.
 */
export interface FrameCopy {
  items: BoardItem[];
  /** How many wires were dropped for pointing outside the frame. */
  severed: number;
  wires: BoardWire[];
}

export type { CopyTarget } from "../../types";

/** The frames and everything on them, each once (a frame may sit in another). */
const insideAll = (frames: BoardItem[], items: BoardItem[]): BoardItem[] => {
  const seen = new Set<string>();
  const out: BoardItem[] = [];
  for (const item of frames.flatMap((f) => [f, ...containedBy(f, items)])) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
};

/**
 * What a copy would take, without doing it.
 *
 * The menu says how much is about to move and what will not survive, and it has
 * to say so before anything is minted — so the counting lives here rather than
 * being read off a discarded copy.
 */
export const frameSummary = (
  frame: BoardItem | BoardItem[],
  items: BoardItem[],
  wires: BoardWire[]
): { count: number; severed: number } => {
  const inside = new Set(
    insideAll(Array.isArray(frame) ? frame : [frame], items).map((i) => i.id)
  );
  return {
    count: inside.size,
    severed: wires.filter(
      (wire) => inside.has(wire.sourceItemId) !== inside.has(wire.targetItemId)
    ).length,
  };
};

const MARGIN = 200;

/**
 * Where copies land on a board: clear to the right of what's already there,
 * level with its top, or near the origin on an empty one.
 */
export const landingOn = (existing: BoardItem[]): { x: number; y: number } =>
  existing.length === 0
    ? { x: MARGIN, y: MARGIN }
    : {
        x: Math.max(...existing.map((i) => i.x + i.width)) + MARGIN * 2,
        y: Math.min(...existing.map((i) => i.y)),
      };

/**
 * Frames and their contents as new items, laid out as they were relative to
 * each other, with the group's top-left corner at `at`.
 */
export const copyOfFrames = (
  frames: BoardItem[],
  items: BoardItem[],
  wires: BoardWire[],
  at: { x: number; y: number } = { x: MARGIN, y: MARGIN }
): FrameCopy => {
  const inside = insideAll(frames, items);
  const idMap = new Map(inside.map((item) => [item.id, newItemId()]));

  // Moved as one, so the arrangement is kept exactly; only its place changes.
  const dx = Math.min(...frames.map((f) => f.x)) - at.x;
  const dy = Math.min(...frames.map((f) => f.y)) - at.y;

  const copiedItems = inside.map((item) => ({
    ...item,
    id: idMap.get(item.id) ?? newItemId(),
    // Absent on the new board for the reason given above; spelled out rather
    // than left to the spread so a future field cannot smuggle one across.
    result: null,
    runError: null,
    runState: null,
    x: item.x - dx,
    y: item.y - dy,
  }));

  const kept = wires.filter(
    (wire) => idMap.has(wire.sourceItemId) && idMap.has(wire.targetItemId)
  );

  const copiedWires = kept.map((wire) => ({
    ...wire,
    id: newItemId(),
    sourceItemId: idMap.get(wire.sourceItemId) ?? wire.sourceItemId,
    targetItemId: idMap.get(wire.targetItemId) ?? wire.targetItemId,
  }));

  return {
    items: copiedItems,
    severed: frameSummary(frames, items, wires).severed,
    wires: copiedWires,
  };
};

/** One frame and its contents, near the origin of a new board. */
export const copyOfFrame = (
  frame: BoardItem,
  items: BoardItem[],
  wires: BoardWire[]
): FrameCopy => copyOfFrames([frame], items, wires);

/** The name a copied frame suggests for its board. */
export const frameBoardTitle = (frame: BoardItem): string =>
  frame.body?.trim() || "Untitled board";
