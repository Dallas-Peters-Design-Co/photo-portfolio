import {
  Circle,
  ImageIcon,
  Redo2,
  Sparkles,
  Square,
  SquareRoundCorner,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sizeFromTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import { ColorWell } from "../ColorWell";
import { isDrawingConfig } from "../drawing/drawing";
import { requestHistory } from "../hooks/historyRequest";
import { BrandDock } from "../panels/BrandDock";
import { Artboard } from "./Artboard";
import { BrandPanel } from "./BrandPanel";
import { ContextBar } from "./ContextBar";
import {
  duplicate,
  layerKind,
  layersOf,
  newImage,
  newShape,
  newText,
  patchItems,
  type Reorder,
  reorder,
  type ShapeTool,
} from "./creativeModel";
import { ExportMenu } from "./ExportMenu";
import { GenerateImage } from "./GenerateImage";
import { LayersList } from "./LayersList";
import "./CreativeEditor.css";

/**
 * A frame, opened as a design: the artboard full screen, with text, shapes and
 * brand images to place, a layers list, snapping, and PNG export at the ad's
 * real size. Every change is a board change, so undo (⌘Z, or the header's
 * Undo and Redo) is the board's history.
 */

export interface CreativeEditorProps {
  frameId: string;
  items: BoardItem[];
  onChange: (next: BoardItem[]) => void;
  onClose: () => void;
  onDropFiles?: (files: File[], point: { x: number; y: number }) => void;
}

const STACK_KEYS: Record<string, { far: Reorder; near: Reorder }> = {
  "[": { far: "back", near: "backward" },
  "]": { far: "front", near: "forward" },
};

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

const aspectOf = (url: string): Promise<number> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
    img.onerror = () => resolve(1);
    img.src = url;
  });

/** The bottom layer, when it is a shape covering the whole artboard. */
const backgroundOf = (
  frame: BoardItem,
  layers: BoardItem[]
): BoardItem | null => {
  const [bottom] = layers;
  return bottom &&
    bottom.kind === "drawing" &&
    bottom.x <= frame.x &&
    bottom.y <= frame.y &&
    bottom.x + bottom.width >= frame.x + frame.width &&
    bottom.y + bottom.height >= frame.y + frame.height
    ? bottom
    : null;
};

export function CreativeEditor({
  frameId,
  items,
  onChange,
  onClose,
  onDropFiles,
}: CreativeEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBrand, setShowBrand] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const textEls = useRef(new Map<string, HTMLElement>());
  const palette = useActiveBrand()?.kit?.resolvedDoc.palette ?? [];

  const frame = items.find((item) => item.id === frameId);
  const layers = frame ? layersOf(frame, items) : [];
  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const background = frame ? backgroundOf(frame, layers) : null;

  const patch = (id: string, next: Partial<BoardItem>) =>
    onChange(patchItems(items, new Map([[id, next]])));

  const add = (item: BoardItem) => {
    onChange([...items, item]);
    setSelectedId(item.id);
  };

  const remove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
    setSelectedId(null);
  };

  const order = (id: string, how: Reorder) => {
    const zs = reorder(layers, id, how);
    onChange(
      patchItems(items, new Map([...zs].map(([key, z]) => [key, { z }])))
    );
  };

  const copy = (item: BoardItem) => add(duplicate(item, items));

  /** What a key does to the selected layer, or null to let it through. */
  const keyAction = (
    e: KeyboardEvent,
    layer: BoardItem
  ): (() => void) | null => {
    const mod = e.metaKey || e.ctrlKey;
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
    };
    const delta = nudge[e.key];
    if (delta) {
      return () =>
        patch(layer.id, { x: layer.x + delta[0], y: layer.y + delta[1] });
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      return () => remove(layer.id);
    }
    if (mod && e.key.toLowerCase() === "d") {
      return () => copy(layer);
    }
    const stack = mod ? STACK_KEYS[e.key] : undefined;
    if (stack) {
      return () => order(layer.id, e.shiftKey ? stack.far : stack.near);
    }
    if (e.key === "Enter" && layerKind(layer) === "text") {
      return () => setEditingId(layer.id);
    }
    return null;
  };

  // Keys, caught before the board's own so a Delete here never reaches the
  // board's selection. Undo is left alone: the board's handles it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (selectedId) {
          setSelectedId(null);
        } else {
          onClose();
        }
        return;
      }
      const action = selected ? keyAction(e, selected) : null;
      if (action) {
        action();
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  });

  if (!frame) {
    return null;
  }

  const size = sizeFromTitle(frame.body);
  const name = frame.body?.trim() || "Untitled frame";

  const brandFill = palette[0]?.value ?? "#e5e5e5";
  const shape = (tool: ShapeTool) =>
    add(newShape(frame, items, tool, brandFill));

  const setBackground = (fill: string) => {
    if (background && isDrawingConfig(background.config)) {
      patch(background.id, {
        config: { ...background.config, fill } as unknown as Record<
          string,
          unknown
        >,
      });
      return;
    }
    const rect = newShape(frame, items, "rect", fill);
    const lowest = Math.min(...layers.map((l) => l.z), rect.z);
    onChange([
      ...items,
      {
        ...rect,
        height: frame.height,
        width: frame.width,
        x: frame.x,
        y: frame.y,
        z: lowest - 1,
      },
    ]);
  };

  return (
    <div
      aria-label={`Design ${name}`}
      aria-modal
      className="creative"
      role="dialog"
    >
      <header className="creative__header">
        <div className="creative__title">
          <strong>{name}</strong>
          {size ? (
            <span>
              {size.w}×{size.h}px
            </span>
          ) : null}
        </div>
        <div className="creative__actions">
          <div className="creative__history">
            <button
              aria-label="Undo"
              className="creative__button creative__button--icon"
              onClick={() => requestHistory(false)}
              title="Undo (⌘Z)"
              type="button"
            >
              <Undo2 size={15} />
            </button>
            <button
              aria-label="Redo"
              className="creative__button creative__button--icon"
              onClick={() => requestHistory(true)}
              title="Redo (⇧⌘Z)"
              type="button"
            >
              <Redo2 size={15} />
            </button>
          </div>
          <ExportMenu
            frame={frame}
            items={items}
            layers={layers}
            name={name}
            textElementFor={(id) => textEls.current.get(id) ?? null}
          />
          <button
            className="creative__button creative__button--primary"
            onClick={onClose}
            type="button"
          >
            <X size={15} />
            Done
          </button>
        </div>
      </header>

      <aside className="creative__rail">
        <p className="creative__label">Add</p>
        <div className="creative__adds">
          <button
            className="creative__add"
            onClick={() => add(newText(frame, items, "headline"))}
            type="button"
          >
            <Type size={16} /> Headline
          </button>
          <button
            className="creative__add"
            onClick={() => add(newText(frame, items, "body"))}
            type="button"
          >
            <Type size={13} /> Body text
          </button>
          <button
            className="creative__add"
            onClick={() => shape("rect")}
            type="button"
          >
            <Square size={16} /> Rectangle
          </button>
          <button
            className="creative__add"
            onClick={() => shape("rounded")}
            type="button"
          >
            <SquareRoundCorner size={16} /> Rounded
          </button>
          <button
            className="creative__add"
            onClick={() => shape("ellipse")}
            type="button"
          >
            <Circle size={16} /> Ellipse
          </button>
          <button
            aria-pressed={showBrand}
            className="creative__add"
            onClick={() => setShowBrand((v) => !v)}
            type="button"
          >
            <ImageIcon size={16} /> Images
          </button>
          <button
            aria-pressed={showGenerate}
            className="creative__add"
            onClick={() => setShowGenerate((v) => !v)}
            type="button"
          >
            <Sparkles size={16} /> Generate
          </button>
        </div>
        {showGenerate ? (
          <GenerateImage
            background={background}
            frame={frame}
            items={items}
            layers={layers}
            onChange={(next, id) => {
              onChange(next);
              setSelectedId(id);
            }}
          />
        ) : null}
        <div className="creative__background">
          <ColorWell
            label="Background"
            onChange={setBackground}
            value={
              background && isDrawingConfig(background.config)
                ? (background.config.fill ?? "#00000000")
                : "#00000000"
            }
          />
          <span>Background</span>
        </div>
        <p className="creative__hint">
          Drop image files on the artboard to add them.
        </p>
        <p className="creative__label">Layers</p>
        <LayersList
          layers={layers}
          onSelect={(id) => setSelectedId(id)}
          selectedId={selectedId}
        />
      </aside>

      <main className="creative__main">
        {selected ? (
          <ContextBar
            frame={frame}
            item={selected}
            onDelete={() => remove(selected.id)}
            onDuplicate={() => copy(selected)}
            onPatch={(next) => patch(selected.id, next)}
            onReorder={(how) => order(selected.id, how)}
          />
        ) : (
          <div className="creative__bar creative__bar--empty">
            Select a layer to style it. Double-click text to edit. Arrows nudge,
            ⇧ for 10. Hold ⌥ to drag without snapping.
          </div>
        )}
        <Artboard
          editingId={editingId}
          frame={frame}
          layers={layers}
          onCommit={patch}
          onDropFiles={onDropFiles}
          onEditText={setEditingId}
          onSelect={setSelectedId}
          onTextChange={(id, body) => patch(id, { body })}
          selectedId={selectedId}
          textRef={(id, el) => {
            if (el) {
              textEls.current.set(id, el);
            } else {
              textEls.current.delete(id);
            }
          }}
        />
      </main>

      <BrandPanel
        frame={frame}
        items={items}
        layers={layers}
        onChange={onChange}
        onSelect={setSelectedId}
      />

      {showBrand ? (
        <BrandDock
          onClose={() => setShowBrand(false)}
          onInsert={(image) =>
            void aspectOf(image.imageUrl).then((aspect) =>
              add(newImage(frame, items, image.imageUrl, aspect))
            )
          }
        />
      ) : null}
    </div>
  );
}
