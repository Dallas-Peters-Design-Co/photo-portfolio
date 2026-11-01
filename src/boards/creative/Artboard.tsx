import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { textStyleCss } from "../../../config/textStyle";
import type { BoardItem } from "../../types";
import { DrawingView } from "../drawing/DrawingView";
import { isDrawingConfig } from "../drawing/drawing";
import { useTextFont } from "../hooks/useTextFont";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import { imageRadius } from "./imageRadius";
import { type ResizeDrag, resizeStep } from "./resize";
import { type Handle, SelectionBox } from "./SelectionBox";
import { type Guides, snapMove } from "./snap";
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
  | ResizeDrag;

export interface ArtboardProps {
  editingId: string | null;
  frame: BoardItem;
  layers: BoardItem[];
  onCommit: (id: string, patch: Partial<BoardItem>) => void;
  onDropFiles?: (files: File[], point: { x: number; y: number }) => void;
  onEditText: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onTextChange: (id: string, body: string) => void;
  selectedId: string | null;
  textRef: (id: string, el: HTMLElement | null) => void;
}

const boxOf = (item: BoardItem): Box => ({
  height: item.height,
  width: item.width,
  x: item.x,
  y: item.y,
});

function LayerText({
  editing,
  item,
  onChange,
  onDone,
  textRef,
}: {
  editing: boolean;
  item: BoardItem;
  onChange: (body: string) => void;
  onDone: () => void;
  textRef: (el: HTMLElement | null) => void;
}) {
  useTextFont(item.textStyle);
  return (
    <textarea
      className="creative__text text-body text-body--plain"
      onBlur={onDone}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.blur();
        }
      }}
      readOnly={!editing}
      ref={(el) => {
        textRef(el);
        if (el && editing && document.activeElement !== el) {
          el.focus();
          el.select();
        }
      }}
      style={{
        ...textStyleCss(item),
        pointerEvents: editing ? "auto" : "none",
      }}
      value={item.body ?? ""}
    />
  );
}

function LayerBody({
  editing,
  item,
  onDone,
  onTextChange,
  textRef,
}: {
  editing: boolean;
  item: BoardItem;
  onDone: () => void;
  onTextChange: (body: string) => void;
  textRef: (el: HTMLElement | null) => void;
}) {
  if (item.kind === "text" || item.kind === "note") {
    return (
      <LayerText
        editing={editing}
        item={item}
        onChange={onTextChange}
        onDone={onDone}
        textRef={textRef}
      />
    );
  }
  if (item.kind === "drawing" && isDrawingConfig(item.config)) {
    return (
      <DrawingView
        config={item.config}
        height={item.height}
        width={item.width}
      />
    );
  }
  const url = currentImageUrl(item);
  return url ? (
    <img
      alt=""
      className="creative__image"
      draggable={false}
      height={item.height}
      src={url}
      style={
        imageRadius(item) > 0 ? { borderRadius: imageRadius(item) } : undefined
      }
      width={item.width}
    />
  ) : null;
}

export function Artboard({
  editingId,
  frame,
  layers,
  onCommit,
  onDropFiles,
  onEditText,
  onSelect,
  onTextChange,
  selectedId,
  textRef,
}: ArtboardProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<{
    box: Box;
    fontSize: number | null;
  } | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) {
      return;
    }
    const fit = () => {
      const pad = 64;
      setScale(
        Math.min(
          (el.clientWidth - pad) / frame.width,
          (el.clientHeight - pad) / frame.height
        )
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [frame.height, frame.width]);

  const begin = (
    e: ReactPointerEvent,
    item: BoardItem,
    handle: Handle | null,
    passThrough = false
  ) => {
    if (e.button !== 0 || editingId === item.id) {
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
    setDrag(
      handle
        ? { ...common, handle, kind: "resize", originFont: item.fontSize }
        : { ...common, kind: "move", passThrough }
    );
  };

  const move = (e: ReactPointerEvent) => {
    if (!drag) {
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
      const snapped = e.altKey
        ? { box: raw, guides: { x: [], y: [] } }
        : snapMove(raw, frame, others, threshold);
      setLive({ box: snapped.box, fontSize: null });
      setGuides(snapped.guides);
      return;
    }
    const step = resizeStep(
      drag,
      layers.find((l) => l.id === drag.id),
      {
        alt: e.altKey,
        dx,
        dy,
        frame,
        others,
        shift: e.shiftKey,
        threshold,
      }
    );
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

  const end = (e: ReactPointerEvent) => {
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
    } else if (drag && live) {
      const { box, fontSize } = live;
      onCommit(drag.id, {
        height: Math.round(box.height),
        width: Math.round(box.width),
        x: Math.round(box.x),
        y: Math.round(box.y),
        ...(fontSize === null ? {} : { fontSize }),
      });
    }
    setDrag(null);
    setLive(null);
    setGuides({ x: [], y: [] });
  };

  const selected = layers.find((l) => l.id === selectedId);
  const liveSelected = selected && drag?.id === selected.id ? live?.box : null;
  const selectedBox = selected ? (liveSelected ?? boxOf(selected)) : null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the stage receives pointer presses (to deselect) and file drops, like the board surface
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
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
          onPointerMove={move}
          onPointerUp={end}
          style={{
            height: frame.height,
            transform: `scale(${scale})`,
            width: frame.width,
          }}
        >
          {layers.map((item) => {
            const isLive = drag?.id === item.id && live;
            const box = isLive ? live.box : boxOf(item);
            const shown =
              isLive && live.fontSize !== null
                ? { ...item, fontSize: live.fontSize }
                : item;
            const isSelected = selectedId === item.id;
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
                  top: box.y - frame.y,
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
              scale={scale}
            />
          ) : null}
          {guides.x.map((x) => (
            <span
              className="creative__guide creative__guide--v"
              key={`x${x}`}
              style={{ left: x - frame.x, ["--s" as string]: scale }}
            />
          ))}
          {guides.y.map((y) => (
            <span
              className="creative__guide creative__guide--h"
              key={`y${y}`}
              style={{ top: y - frame.y, ["--s" as string]: scale }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
