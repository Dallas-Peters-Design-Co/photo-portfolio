import { useCallback, useState } from "react";
import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";

/**
 * Which layers are selected in the frame editor: one, several, or none.
 *
 * Shift or ⌘ adds and removes; a plain pick replaces. `primary` is the one
 * layer when exactly one is selected, which is what the single-layer controls
 * (handles, the style bar) work on; with several, the group controls take over.
 */
export const useLayerSelection = () => {
  const [ids, setIds] = useState<string[]>([]);

  const select = useCallback((id: string | null, additive = false) => {
    if (id === null) {
      setIds([]);
      return;
    }
    setIds((was) => {
      if (!additive) {
        return [id];
      }
      return was.includes(id) ? was.filter((x) => x !== id) : [...was, id];
    });
  }, []);

  return {
    ids,
    primary: ids.length === 1 ? (ids[0] ?? null) : null,
    select,
    setIds,
  };
};

/** The box around several layers. */
export const unionOf = (boxes: Box[]): Box | null => {
  if (boxes.length === 0) {
    return null;
  }
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { height: bottom - top, width: right - left, x: left, y: top };
};

export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

export type AlignTo = "bottom" | "center" | "left" | "middle" | "right" | "top";

/** Lines the layers up on one edge or centre of the box around them all. */
export const alignLayers = (
  layers: BoardItem[],
  to: AlignTo
): Map<string, Partial<BoardItem>> => {
  const box = unionOf(layers);
  const out = new Map<string, Partial<BoardItem>>();
  if (!box) {
    return out;
  }
  const place: Record<AlignTo, (l: BoardItem) => Partial<BoardItem>> = {
    bottom: (l) => ({ y: box.y + box.height - l.height }),
    center: (l) => ({ x: Math.round(box.x + (box.width - l.width) / 2) }),
    left: () => ({ x: box.x }),
    middle: (l) => ({ y: Math.round(box.y + (box.height - l.height) / 2) }),
    right: (l) => ({ x: box.x + box.width - l.width }),
    top: () => ({ y: box.y }),
  };
  for (const l of layers) {
    out.set(l.id, place[to](l));
  }
  return out;
};

/**
 * Even gaps between three or more layers, across or down: the outermost two
 * stay put and the rest are spaced between them in their current order.
 */
export const distributeLayers = (
  layers: BoardItem[],
  axis: "x" | "y"
): Map<string, Partial<BoardItem>> => {
  const out = new Map<string, Partial<BoardItem>>();
  if (layers.length < 3) {
    return out;
  }
  const size = axis === "x" ? "width" : "height";
  const sorted = [...layers].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0] as BoardItem;
  const last = sorted.at(-1) as BoardItem;
  const span = last[axis] + last[size] - first[axis];
  const filled = sorted.reduce((n, l) => n + l[size], 0);
  const gap = (span - filled) / (sorted.length - 1);
  let at = first[axis];
  for (const l of sorted) {
    out.set(l.id, { [axis]: Math.round(at) });
    at += l[size] + gap;
  }
  return out;
};
