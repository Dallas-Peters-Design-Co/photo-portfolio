import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";
import type { Handle } from "./SelectionBox";
import { type Guides, snapEdge } from "./snap";

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

/** One step of a resize: the new box, the font size for text, the guides. */
export const resizeStep = (
  drag: ResizeDrag,
  item: BoardItem | undefined,
  m: {
    alt: boolean;
    dx: number;
    dy: number;
    frame: Box;
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
  let box = resized(drag.origin, drag.handle, m.dx, m.dy, keepAspect);
  const guides: Guides = { x: [], y: [] };
  if (!(m.alt || keepAspect)) {
    if (drag.handle.includes("e")) {
      const s = snapEdge(
        box.x + box.width,
        "x",
        m.frame,
        m.others,
        m.threshold
      );
      box = { ...box, width: Math.max(MIN, s.value - box.x) };
      guides.x = s.line === null ? [] : [s.line];
    }
    if (drag.handle.includes("s")) {
      const s = snapEdge(
        box.y + box.height,
        "y",
        m.frame,
        m.others,
        m.threshold
      );
      box = { ...box, height: Math.max(MIN, s.value - box.y) };
      guides.y = s.line === null ? [] : [s.line];
    }
  }
  // Text scales its type with a corner drag, as a design tool does; an edge
  // drag only changes where it wraps.
  const corner = drag.handle.length === 2;
  const fontSize =
    isText && corner && drag.originFont
      ? Math.max(
          8,
          Math.round((drag.originFont * box.width) / drag.origin.width)
        )
      : null;
  return { box, fontSize, guides };
};
