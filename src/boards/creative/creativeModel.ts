import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../../../config/canvas";
import { containedBy } from "../../../config/graph";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import type { DrawingConfig } from "../drawing/drawing";
import { newItemId } from "../io/newItemId";

/**
 * The creative editor's model: a frame is the artboard, and the board items
 * sitting on it are its layers. Nothing is stored apart from the board, so a
 * design edited here is the same design on the board, in ad sizes, in Present
 * and on the published page.
 *
 * Pure, so layer order, placement and duplication are pinned by tests.
 */

export interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** The kinds the editor can place and style. */
export type LayerKind = "image" | "shape" | "text";

export const layerKind = (item: BoardItem): LayerKind | null => {
  if (item.kind === "text" || item.kind === "note") {
    return "text";
  }
  if (item.kind === "drawing") {
    return "shape";
  }
  if (item.kind === "reference" || item.kind === "photo") {
    return "image";
  }
  return null;
};

/** The frame's layers, back to front. */
export const layersOf = (frame: BoardItem, items: BoardItem[]): BoardItem[] =>
  containedBy(frame, items)
    .filter((item) => layerKind(item) !== null)
    .sort((a, b) => a.z - b.z);

const topZ = (items: BoardItem[]): number =>
  Math.max(0, ...items.map((item) => item.z)) + 1;

/** Shorter side of the frame, which sizes new things in proportion. */
const unit = (frame: Box): number => Math.min(frame.width, frame.height);

const clampFont = (size: number): number =>
  Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size)));

export const newText = (
  frame: Box,
  items: BoardItem[],
  role: "body" | "headline" = "headline"
): BoardItem => {
  const fontSize = clampFont(
    unit(frame) * (role === "headline" ? 0.09 : 0.045)
  );
  const width = Math.round(frame.width * 0.7);
  const height = Math.round(fontSize * (role === "headline" ? 2.6 : 3.6));
  return {
    ...BLANK_ITEM,
    body:
      role === "headline" ? "Your headline here" : "Supporting line of copy",
    fontSize,
    height,
    id: newItemId(),
    kind: "text",
    textStyle: {
      align: "center",
      color: null,
      family: null,
      italic: null,
      letterSpacing: null,
      lineHeight: 1.1,
      transform: null,
      weight: role === "headline" ? 700 : 400,
    },
    width,
    x: Math.round(frame.x + (frame.width - width) / 2),
    // Headline above the middle, body copy below it, so adding one of each
    // gives a readable stack rather than two blocks on top of each other.
    y: Math.round(
      frame.y + frame.height * (role === "headline" ? 0.32 : 0.56) - height / 2
    ),
    z: topZ(items),
  };
};

export type ShapeTool =
  | "arrow"
  | "ellipse"
  | "line"
  | "polygon"
  | "rect"
  | "rounded"
  | "squircle"
  | "star"
  | "triangle";

export const newShape = (
  frame: Box,
  items: BoardItem[],
  tool: ShapeTool,
  fill: string
): BoardItem => {
  const size = Math.round(unit(frame) * 0.4);
  // A line is drawn in the colour, left to right, across a box just tall
  // enough to grab; every other shape is filled with it.
  const line = tool === "line" || tool === "arrow";
  const weight = Math.max(4, Math.round(size * 0.03));
  const config: DrawingConfig = line
    ? {
        fill: null,
        opacity: 1,
        points: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
        stroke: fill,
        strokeWidth: weight,
        tool,
      }
    : {
        fill,
        opacity: 1,
        radius: tool === "rounded" ? Math.round(size * 0.12) : 0,
        stroke: "#00000000",
        strokeWidth: 0,
        tool,
      };
  const height = line ? weight * 8 : size;
  return {
    ...BLANK_ITEM,
    config: config as unknown as Record<string, unknown>,
    height,
    id: newItemId(),
    kind: "drawing",
    width: size,
    x: Math.round(frame.x + (frame.width - size) / 2),
    y: Math.round(frame.y + (frame.height - height) / 2),
    z: topZ(items),
  };
};

/** An image, fitted inside the frame at its own aspect ratio. */
export const newImage = (
  frame: Box,
  items: BoardItem[],
  url: string,
  aspect = 1,
  fill = 0.6
): BoardItem => {
  let width = frame.width * fill;
  let height = width / aspect;
  if (height > frame.height * fill) {
    height = frame.height * fill;
    width = height * aspect;
  }
  return {
    ...BLANK_ITEM,
    height: Math.round(height),
    id: newItemId(),
    imageUrl: url,
    kind: "reference",
    thumbUrl: url,
    width: Math.round(width),
    x: Math.round(frame.x + (frame.width - width) / 2),
    y: Math.round(frame.y + (frame.height - height) / 2),
    z: topZ(items),
  };
};

/** A copy, nudged so it is visibly a second one, on top. */
export const duplicate = (item: BoardItem, items: BoardItem[]): BoardItem => {
  const nudge = Math.max(
    8,
    Math.round(Math.min(item.width, item.height) * 0.06)
  );
  return {
    ...item,
    id: newItemId(),
    recipeUseId: null,
    x: item.x + nudge,
    y: item.y + nudge,
    z: topZ(items),
  };
};

export type Reorder = "back" | "backward" | "forward" | "front";

/**
 * Moves one layer within the frame's stack by rewriting the z of the frame's
 * layers only, keeping them in the same band of z they already used so the
 * frame's stacking against the rest of the board doesn't change.
 */
export const reorder = (
  layers: BoardItem[],
  id: string,
  how: Reorder
): Map<string, number> => {
  const order = [...layers].sort((a, b) => a.z - b.z);
  const at = order.findIndex((item) => item.id === id);
  if (at < 0) {
    return new Map();
  }
  const [moving] = order.splice(at, 1);
  if (!moving) {
    return new Map();
  }
  const to = {
    back: 0,
    backward: Math.max(0, at - 1),
    forward: Math.min(order.length, at + 1),
    front: order.length,
  }[how];
  order.splice(to, 0, moving);
  const zs = layers.map((item) => item.z).sort((a, b) => a - b);
  // Distinct, increasing z for the band, starting where it started.
  const base = zs[0] ?? 1;
  return new Map(order.map((item, i) => [item.id, base + i]));
};

/**
 * Moves layers to a place in the stack, as dragging them in the layers list
 * does. `before` is the layer they land in front of in the list (the list runs
 * front first), or null for the very back. Moved layers keep their own order,
 * and the band of z the frame's layers already use stays the same.
 */
export const moveInStack = (
  layers: BoardItem[],
  moving: string[],
  before: string | null
): Map<string, number> => {
  const frontFirst = [...layers].sort((a, b) => b.z - a.z);
  const moved = frontFirst.filter((l) => moving.includes(l.id));
  const rest = frontFirst.filter((l) => !moving.includes(l.id));
  const at =
    before === null ? rest.length : rest.findIndex((l) => l.id === before);
  const order = [...rest];
  order.splice(at < 0 ? rest.length : at, 0, ...moved);
  const base = Math.min(...layers.map((l) => l.z));
  const back = order.length - 1;
  return new Map(order.map((l, i) => [l.id, base + back - i]));
};

/** Applies a batch of per-id patches to the board. */
export const patchItems = (
  items: BoardItem[],
  patches: Map<string, Partial<BoardItem>>
): BoardItem[] =>
  items.map((item) => {
    const patch = patches.get(item.id);
    return patch ? { ...item, ...patch } : item;
  });
