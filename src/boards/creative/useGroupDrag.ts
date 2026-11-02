import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useState,
} from "react";
import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";
import { overlaps, unionOf } from "./selection";
import { type Guides, skipsSnap, snapMove } from "./snap";

/**
 * Moving several layers at once, and the marquee that selects them.
 *
 * A group moves by one offset, snapped as a whole: the box around the
 * selection snaps to the frame and the other layers, the way a single layer
 * does. A marquee starts on empty artboard and selects every layer it
 * touches; Shift adds to what was selected. A press on empty artboard that
 * doesn't move clears the selection.
 */

type GroupDrag =
  | {
      ids: string[];
      kind: "group";
      startX: number;
      startY: number;
      union: Box;
    }
  | {
      additive: boolean;
      kind: "marquee";
      start: { x: number; y: number };
      startX: number;
      startY: number;
    };

const boxOf = (item: BoardItem): Box => ({
  height: item.height,
  width: item.width,
  x: item.x,
  y: item.y,
});

export const useGroupDrag = ({
  boardRef,
  frame,
  layers,
  onCommitMany,
  onCopyMoved,
  onSelectMany,
  scale,
  selectedIds,
  snapPx,
}: {
  boardRef: RefObject<HTMLDivElement | null>;
  frame: Box;
  layers: BoardItem[];
  onCommitMany: (patches: Map<string, Partial<BoardItem>>) => void;
  /** ⌥ held on release: copies land where the drag ended, the originals stay. */
  onCopyMoved: (ids: string[], dx: number, dy: number) => void;
  onSelectMany: (ids: string[]) => void;
  scale: number;
  selectedIds: string[];
  snapPx: number;
}) => {
  const [drag, setDrag] = useState<GroupDrag | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });

  /** A pointer position in canvas units. */
  const toCanvas = (e: ReactPointerEvent) => {
    const rect = boardRef.current?.getBoundingClientRect();
    return {
      x: frame.x + (e.clientX - (rect?.left ?? 0)) / scale,
      y: frame.y + (e.clientY - (rect?.top ?? 0)) / scale,
    };
  };

  const capture = (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    boardRef.current?.setPointerCapture?.(e.pointerId);
  };

  /** A press on a layer that's part of a multiple selection. */
  const startGroup = (e: ReactPointerEvent) => {
    const chosen = layers.filter((l) => selectedIds.includes(l.id));
    const union = unionOf(chosen.map(boxOf));
    if (!union) {
      return;
    }
    capture(e);
    setDrag({
      ids: chosen.map((l) => l.id),
      kind: "group",
      startX: e.clientX,
      startY: e.clientY,
      union,
    });
  };

  /** A press on empty artboard. */
  const startMarquee = (e: ReactPointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    capture(e);
    setDrag({
      additive: e.shiftKey || e.metaKey,
      kind: "marquee",
      start: toCanvas(e),
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  /** True when the move was the group's or the marquee's. */
  const move = (e: ReactPointerEvent): boolean => {
    if (!drag) {
      return false;
    }
    if (drag.kind === "marquee") {
      const p = toCanvas(e);
      setMarquee({
        height: Math.abs(p.y - drag.start.y),
        width: Math.abs(p.x - drag.start.x),
        x: Math.min(p.x, drag.start.x),
        y: Math.min(p.y, drag.start.y),
      });
      return true;
    }
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const moved = { ...drag.union, x: drag.union.x + dx, y: drag.union.y + dy };
    const others = layers.filter((l) => !drag.ids.includes(l.id)).map(boxOf);
    const snapped = skipsSnap(e)
      ? { box: moved, guides: { x: [], y: [] } }
      : snapMove(moved, frame, others, snapPx / scale);
    setOffset({
      dx: snapped.box.x - drag.union.x,
      dy: snapped.box.y - drag.union.y,
    });
    setGuides(snapped.guides);
    return true;
  };

  const finishMarquee = (
    e: ReactPointerEvent,
    d: Extract<GroupDrag, { kind: "marquee" }>
  ) => {
    const still =
      Math.abs(e.clientX - d.startX) < 3 && Math.abs(e.clientY - d.startY) < 3;
    const hit =
      still || !marquee
        ? []
        : layers.filter((l) => overlaps(boxOf(l), marquee)).map((l) => l.id);
    onSelectMany(d.additive ? [...new Set([...selectedIds, ...hit])] : hit);
  };

  const finishGroup = (
    e: ReactPointerEvent,
    d: Extract<GroupDrag, { kind: "group" }>
  ) => {
    if (!(offset && (offset.dx || offset.dy))) {
      return;
    }
    if (e.altKey) {
      onCopyMoved(d.ids, Math.round(offset.dx), Math.round(offset.dy));
      return;
    }
    onCommitMany(
      new Map(
        layers
          .filter((l) => d.ids.includes(l.id))
          .map((l) => [
            l.id,
            { x: Math.round(l.x + offset.dx), y: Math.round(l.y + offset.dy) },
          ])
      )
    );
  };

  /** True when the release ended the group's or the marquee's drag. */
  const end = (e: ReactPointerEvent): boolean => {
    if (!drag) {
      return false;
    }
    if (drag.kind === "marquee") {
      finishMarquee(e, drag);
    } else {
      finishGroup(e, drag);
    }
    setDrag(null);
    setOffset(null);
    setMarquee(null);
    setGuides({ x: [], y: [] });
    return true;
  };

  /** Where a layer is drawn mid-drag. */
  const shownBox = (item: BoardItem): Box | null =>
    drag?.kind === "group" && offset && drag.ids.includes(item.id)
      ? { ...boxOf(item), x: item.x + offset.dx, y: item.y + offset.dy }
      : null;

  return { end, guides, marquee, move, shownBox, startGroup, startMarquee };
};
