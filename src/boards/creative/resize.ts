import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";
import type { Handle } from "./SelectionBox";
import { type Guides, snapEdge } from "./snap";
import type { Insets } from "./visibleEdges";

/** Resizing a layer from a handle or side, with snapping and text scaling. */

export const MIN = 8;

export interface ResizeDrag {
  handle: Handle;
  id: string;
  kind: "resize";
  origin: Box;
  originFont: number | null;
  startX: number;
  startY: number;
}

/** A resize from one handle, in canvas units. */
export const resized = (
  origin: Box,
  handle: Handle,
  dx: number,
  dy: number,
  keepAspect: boolean
): Box => {
  let { height, width, x, y } = origin;
  if (handle.includes("e")) {
    width = origin.width + dx;
  }
  if (handle.includes("w")) {
    width = origin.width - dx;
  }
  if (handle.includes("s")) {
    height = origin.height + dy;
  }
  if (handle.includes("n")) {
    height = origin.height - dy;
  }
  if (keepAspect && handle.length === 2) {
    const ratio = origin.width / origin.height;
    if (Math.abs(dx) * origin.height > Math.abs(dy) * origin.width) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }
  width = Math.max(MIN, width);
  height = Math.max(MIN, height);
  if (handle.includes("w")) {
    x = origin.x + origin.width - width;
  }
  if (handle.includes("n")) {
    y = origin.y + origin.height - height;
  }
  return { height, width, x, y };
};

interface SnapTo {
  frame: Box;
  others: Box[];
  threshold: number;
}

const NONE: Insets = { b: 0, l: 0, r: 0, t: 0 };

/** The origin's insets grown or shrunk with the box. */
const scaledInsets = (ins: Insets | null, origin: Box, box: Box): Insets => {
  if (!ins) {
    return NONE;
  }
  const kx = box.width / origin.width;
  const ky = box.height / origin.height;
  return { b: ins.b * ky, l: ins.l * kx, r: ins.r * kx, t: ins.t * ky };
};

/** Each moving side snapped on its own; the opposite sides stay put. */
const snapSides = (
  start: Box,
  handle: Handle,
  ins: Insets,
  m: SnapTo
): { box: Box; guides: Guides } => {
  let box = start;
  const guides: Guides = { x: [], y: [] };
  const edge = (value: number, axis: "x" | "y") =>
    snapEdge(value, axis, m.frame, m.others, m.threshold);
  if (handle.includes("e")) {
    const s = edge(box.x + box.width - ins.r, "x");
    box = { ...box, width: Math.max(MIN, s.value + ins.r - box.x) };
    guides.x = s.line === null ? [] : [s.line];
  }
  if (handle.includes("w")) {
    const right = box.x + box.width;
    const s = edge(box.x + ins.l, "x");
    const x = Math.min(right - MIN, s.value - ins.l);
    box = { ...box, width: right - x, x };
    guides.x = s.line === null ? [] : [s.line];
  }
  if (handle.includes("s")) {
    const s = edge(box.y + box.height - ins.b, "y");
    box = { ...box, height: Math.max(MIN, s.value + ins.b - box.y) };
    guides.y = s.line === null ? [] : [s.line];
  }
  if (handle.includes("n")) {
    const bottom = box.y + box.height;
    const s = edge(box.y + ins.t, "y");
    const y = Math.min(bottom - MIN, s.value - ins.t);
    box = { ...box, height: bottom - y, y };
    guides.y = s.line === null ? [] : [s.line];
  }
  return { box, guides };
};

/**
 * A corner that keeps the shape: whichever moving side is nearer a line
 * snaps, and the other side follows the aspect.
 */
const snapCorner = (
  start: Box,
  handle: Handle,
  ins: Insets,
  m: SnapTo
): { box: Box; guides: Guides } => {
  const free = snapSides(start, handle, ins, m);
  const dx = Math.abs(free.box.width - start.width);
  const dy = Math.abs(free.box.height - start.height);
  const hasX = free.guides.x.length > 0;
  const hasY = free.guides.y.length > 0;
  if (!(hasX || hasY)) {
    return { box: start, guides: { x: [], y: [] } };
  }
  const ratio = start.width / start.height;
  const byX = hasX && (!hasY || dx <= dy);
  const width = byX ? free.box.width : free.box.height * ratio;
  const height = byX ? free.box.width / ratio : free.box.height;
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  return {
    box: {
      height,
      width,
      x: handle.includes("w") ? right - width : start.x,
      y: handle.includes("n") ? bottom - height : start.y,
    },
    guides: byX ? { x: free.guides.x, y: [] } : { x: [], y: free.guides.y },
  };
};

/** One step of a resize: the new box, the font size for text, the guides. */
export const resizeStep = (
  drag: ResizeDrag,
  item: BoardItem | undefined,
  m: {
    alt: boolean;
    dx: number;
    dy: number;
    frame: Box;
    /** Margins inside the box round what's drawn (visibleEdges.ts). */
    inset?: Insets | null;
    others: Box[];
    shift: boolean;
    threshold: number;
  }
): { box: Box; fontSize: number | null; guides: Guides } => {
  const isText = item?.kind === "text" || item?.kind === "note";
  const isPicture = item?.kind === "reference" || item?.kind === "photo";
  // A component scales as one thing from a corner (Shift stretches it); a
  // side stretches it. resized() only keeps the aspect on corners.
  const isInstance = item?.kind === "component";
  const keepAspect = isInstance ? !m.shift : m.shift || isPicture || isText;
  const raw = resized(drag.origin, drag.handle, m.dx, m.dy, keepAspect);
  const corner = drag.handle.length === 2;
  // What's drawn inside the box lines up, its margins scaled with it.
  const ins = scaledInsets(m.inset ?? null, drag.origin, raw);
  const snap = keepAspect && corner ? snapCorner : snapSides;
  const { box, guides } = m.alt
    ? { box: raw, guides: { x: [], y: [] } as Guides }
    : snap(raw, drag.handle, ins, m);
  // Text scales its type with a corner drag, as a design tool does; an edge
  // drag only changes where it wraps.
  const fontSize =
    isText && corner && drag.originFont
      ? Math.max(
          8,
          Math.round((drag.originFont * box.width) / drag.origin.width)
        )
      : null;
  return { box, fontSize, guides };
};
