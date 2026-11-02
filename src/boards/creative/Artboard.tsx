import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import type { BoardItem } from "../../types";
import { GroupOutline, LayerBody } from "./ArtboardLayers";
import type { Box } from "./creativeModel";
import { opacityCss } from "./layerOpacity";
import { sayIfLeftFrame } from "./leftFrame";
import { type ResizeDrag, resizeStep } from "./resize";
import { dragAngle, rotateCss, rotationOf, toLocal } from "./rotate";
import { type Handle, SelectionBox } from "./SelectionBox";
import { unionOf } from "./selection";
import { type Guides, skipsSnap, snapMove } from "./snap";
import { useArtboardZoom } from "./useArtboardZoom";
import { useGroupDrag } from "./useGroupDrag";
import { ZoomBar } from "./ZoomBar";
import "../itemBodies.css";

/**
 * The artboard: the frame at a size that fits the screen, its layers drawn
 * the way the board draws them, and the handles for moving and resizing.
 *
 * Everything is laid out in canvas units inside one scaled box, so a layer
 * here is pixel-for-pixel the layer on the board.
 */

const SNAP_PX = 6;

type Drag =
  | {
      id: string;
      kind: "move";
      origin: Box;
      /** Pressed inside the selection: a click without a drag selects what's on top. */
      passThrough: boolean;
      startX: number;
      startY: number;
    }
  | ResizeDrag
  | {
      /** The selection's centre on screen, which the angle turns about. */
      center: { x: number; y: number };
      id: string;
      kind: "rotate";
      origin: Box;
      originAngle: number;
      startX: number;
      startY: number;
    };

export interface ArtboardProps {
  editingId: string | null;
  frame: BoardItem;
  layers: BoardItem[];
  onCommit: (id: string, patch: Partial<BoardItem>) => void;
  /** Several layers' changes as one step (a group move). */
  onCommitMany: (patches: Map<string, Partial<BoardItem>>) => void;
  /** ⌥-drag: copies of these layers, moved by this much; the originals stay. */
  onCopyMoved: (ids: string[], dx: number, dy: number) => void;
  onDropFiles?: (files: File[], point: { x: number; y: number }) => void;
  onEditText: (id: string | null) => void;
  /** Picks a layer; `additive` (Shift or ⌘) adds or removes it instead. */
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectMany: (ids: string[]) => void;
  onTextChange: (id: string, body: string) => void;
  selectedIds: string[];
  textRef: (id: string, el: HTMLElement | null) => void;
}

const boxOf = (item: BoardItem): Box => ({
  height: item.height,
  width: item.width,
  x: item.x,
  y: item.y,
});

export function Artboard({
  editingId,
  frame,
  layers,
  onCommit,
  onDropFiles,
  onEditText,
  onCommitMany,
  onCopyMoved,
  onSelect,
  onSelectMany,
  onTextChange,
  selectedIds,
  textRef,
}: ArtboardProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const selectedId = selectedIds.length === 1 ? (selectedIds[0] ?? null) : null;
  const view = useArtboardZoom(stageRef, frame);
  const { scale } = view;
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<{
    box: Box;
    fontSize: number | null;
    rotation?: number;
  } | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const group = useGroupDrag({
    boardRef,
    frame,
    layers,
    onCommitMany,
    onCopyMoved,
    onSelectMany,
    scale,
    selectedIds,
    snapPx: SNAP_PX,
  });

  const begin = (
    e: ReactPointerEvent,
    item: BoardItem,
    handle: Handle | "rotate" | null,
    passThrough = false
  ) => {
    if (e.button !== 0 || editingId === item.id) {
      return;
    }
    // Shift or ⌘ adds the layer to the selection, or takes it out.
    if (handle === null && !passThrough && (e.shiftKey || e.metaKey)) {
      e.stopPropagation();
      e.preventDefault();
      onSelect(item.id, true);
      return;
    }
    // A press on any layer of a multiple selection moves them all.
    if (
      handle === null &&
      selectedIds.length > 1 &&
      selectedIds.includes(item.id)
    ) {
      group.startGroup(e);
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const common = {
      id: item.id,
      origin: boxOf(item),
      startX: e.clientX,
      startY: e.clientY,
    };
    if (handle === "rotate") {
      const rect = (e.currentTarget as HTMLElement)
        .closest("[data-selection]")
        ?.getBoundingClientRect();
      setDrag({
        ...common,
        center: rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: e.clientX, y: e.clientY },
        kind: "rotate",
        originAngle: rotationOf(item),
      });
      return;
    }
    setDrag(
      handle
        ? { ...common, handle, kind: "resize", originFont: item.fontSize }
        : { ...common, kind: "move", passThrough }
    );
  };

  const move = (e: ReactPointerEvent) => {
    if (group.move(e) || !drag) {
      return;
    }
    if (drag.kind === "rotate") {
      const rotation = dragAngle(
        drag.center,
        { x: drag.startX, y: drag.startY },
        { x: e.clientX, y: e.clientY },
        drag.originAngle,
        e.shiftKey
      );
      setLive({ box: drag.origin, fontSize: null, rotation });
      return;
    }
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const others = layers.filter((l) => l.id !== drag.id).map(boxOf);
    const threshold = SNAP_PX / scale;
    if (drag.kind === "move") {
      const raw = {
        ...drag.origin,
        x: drag.origin.x + dx,
        y: drag.origin.y + dy,
      };
      const snapped = skipsSnap(e)
        ? { box: raw, guides: { x: [], y: [] } }
        : snapMove(raw, frame, others, threshold);
      // Free to leave the artboard: that's how a layer is pulled out of the
      // design (leftFrame.ts says so when it lands outside).
      setLive({ box: snapped.box, fontSize: null });
      setGuides(snapped.guides);
      return;
    }
    // A turned layer resizes along its own sides.
    const layer = layers.find((l) => l.id === drag.id);
    const local = toLocal(dx, dy, layer ? rotationOf(layer) : 0);
    const step = resizeStep(drag, layer, {
      alt: skipsSnap(e),
      dx: local.dx,
      dy: local.dy,
      frame,
      others,
      shift: e.shiftKey,
      threshold,
    });
    setLive({ box: step.box, fontSize: step.fontSize });
    setGuides(step.guides);
  };

  /** The layer drawn on top at a point, other than the selected one. */
  const layerUnder = (x: number, y: number): string | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const id = (el as HTMLElement)
        .closest?.("[data-layer-id]")
        ?.getAttribute("data-layer-id");
      if (id && id !== selectedId) {
        return id;
      }
    }
    return null;
  };

  /** A move or resize lands; a ⌥-move drops a copy there instead. */
  const commitBox = (
    d: Drag,
    l: { box: Box; fontSize: number | null },
    copy: boolean
  ) => {
    const { box, fontSize } = l;
    if (d.kind === "move" && copy) {
      onCopyMoved(
        [d.id],
        Math.round(box.x - d.origin.x),
        Math.round(box.y - d.origin.y)
      );
      return;
    }
    onCommit(d.id, {
      height: Math.round(box.height),
      width: Math.round(box.width),
      x: Math.round(box.x),
      y: Math.round(box.y),
      ...(fontSize === null ? {} : { fontSize }),
    });
    if (d.kind === "move") {
      sayIfLeftFrame([box], frame);
    }
  };

  const end = (e: ReactPointerEvent) => {
    if (group.end(e)) {
      return;
    }
    const still =
      Math.abs(e.clientX - (drag?.startX ?? e.clientX)) < 3 &&
      Math.abs(e.clientY - (drag?.startY ?? e.clientY)) < 3;
    if (drag?.kind === "move" && drag.passThrough && still) {
      // A click inside the selection, not a drag: whatever is drawn on top
      // gets it, as in a design tool.
      const under = layerUnder(e.clientX, e.clientY);
      if (under) {
        onSelect(under);
      }
    } else if (drag?.kind === "rotate" && live?.rotation !== undefined) {
      onCommit(drag.id, { rotation: live.rotation });
    } else if (drag && live) {
      commitBox(drag, live, e.altKey && !still);
    }
    setDrag(null);
    setLive(null);
    setGuides({ x: [], y: [] });
  };

  const selected = layers.find((l) => l.id === selectedId);
  const liveSelected = selected && drag?.id === selected.id ? live?.box : null;
  const selectedBox = selected ? (liveSelected ?? boxOf(selected)) : null;
  const angleOf = (item: BoardItem) =>
    drag?.id === item.id && live?.rotation !== undefined
      ? live.rotation
      : rotationOf(item);

  return (
    <div className="creative__viewport">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the stage receives pointer presses (to deselect) and file drops, like the board surface */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: same */}
      <div
        className="creative__stage"
        onDragOver={(e) => {
          if (onDropFiles && e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files);
          if (!(onDropFiles && files.length > 0)) {
            return;
          }
          e.preventDefault();
          onDropFiles(files, {
            x: frame.x + frame.width / 2,
            y: frame.y + frame.height / 2,
          });
        }}
        onPointerDown={() => {
          onSelect(null);
          onEditText(null);
        }}
        ref={stageRef}
      >
        <div
          className="creative__fit"
          style={{ height: frame.height * scale, width: frame.width * scale }}
        >
          <div
            className="creative__board"
            onPointerCancel={end}
            onPointerDown={group.startMarquee}
            onPointerMove={move}
            onPointerUp={end}
            ref={boardRef}
            style={{
              height: frame.height,
              transform: `scale(${scale})`,
              width: frame.width,
            }}
          >
            {layers.map((item) => {
              const isLive = drag?.id === item.id && live;
              const box =
                group.shownBox(item) ?? (isLive ? live.box : boxOf(item));
              const shown =
                isLive && live.fontSize !== null
                  ? { ...item, fontSize: live.fontSize }
                  : item;
              const isSelected = selectedIds.includes(item.id);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: a layer is a pointer target on a canvas; the layers list is its keyboard route
                // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
                <div
                  className={
                    isSelected
                      ? "creative__layer creative__layer--selected"
                      : "creative__layer"
                  }
                  data-layer-id={item.id}
                  key={item.id}
                  onDoubleClick={() => {
                    if (item.kind === "text" || item.kind === "note") {
                      onEditText(item.id);
                    }
                  }}
                  onPointerDown={(e) => begin(e, item, null)}
                  style={{
                    height: box.height,
                    left: box.x - frame.x,
                    opacity: opacityCss(item),
                    top: box.y - frame.y,
                    transform: rotateCss(angleOf(item)),
                    width: box.width,
                  }}
                >
                  <LayerBody
                    editing={editingId === item.id}
                    item={{ ...shown, height: box.height, width: box.width }}
                    onDone={() => onEditText(null)}
                    onTextChange={(body) => onTextChange(item.id, body)}
                    textRef={(el) => textRef(item.id, el)}
                  />
                </div>
              );
            })}
            {selected && selectedBox && editingId !== selected.id ? (
              <SelectionBox
                box={selectedBox}
                frame={frame}
                onBegin={(e, handle) =>
                  begin(e, selected, handle, handle === null)
                }
                onDoubleClick={() => {
                  if (selected.kind === "text" || selected.kind === "note") {
                    onEditText(selected.id);
                  }
                }}
                rotation={angleOf(selected)}
                scale={scale}
              />
            ) : null}
            {selectedIds.length > 1 ? (
              <GroupOutline
                box={unionOf(
                  layers
                    .filter((l) => selectedIds.includes(l.id))
                    .map((l) => group.shownBox(l) ?? boxOf(l))
                )}
                frame={frame}
              />
            ) : null}
            {group.marquee ? (
              <span
                className="creative__marquee"
                style={{
                  height: group.marquee.height,
                  left: group.marquee.x - frame.x,
                  top: group.marquee.y - frame.y,
                  width: group.marquee.width,
                }}
              />
            ) : null}
            {[...guides.x, ...group.guides.x].map((x) => (
              <span
                className="creative__guide creative__guide--v"
                key={`x${x}`}
                style={{ left: x - frame.x, ["--s" as string]: scale }}
              />
            ))}
            {[...guides.y, ...group.guides.y].map((y) => (
              <span
                className="creative__guide creative__guide--h"
                key={`y${y}`}
                style={{ top: y - frame.y, ["--s" as string]: scale }}
              />
            ))}
          </div>
        </div>
      </div>
      <ZoomBar view={view} />
    </div>
  );
}
