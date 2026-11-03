import {
  Command as CommandIcon,
  ImageIcon,
  Palette,
  Redo2,
  Sparkles,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { sizeFromTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import { ColorWell } from "../ColorWell";
import { isDrawingConfig } from "../drawing/drawing";
import { requestHistory } from "../hooks/historyRequest";
import { BrandDock } from "../panels/BrandDock";
import { useShortcuts } from "../shortcuts/useShortcuts";
import { Artboard } from "./Artboard";
import { BrandPanel } from "./BrandPanel";
import { ContextBar } from "./ContextBar";
import { ComponentsSection } from "./components/ComponentsSection";
import { useComponents } from "./components/useComponents";
import { layersOf, newImage, newShape } from "./creativeModel";
import { EditorOverlays } from "./EditorOverlays";
import { ExportMenu } from "./ExportMenu";
import { frameStudioProps, useFrameStudio } from "./frameStudio";
import { GenerateImage } from "./GenerateImage";
import { LayersList } from "./LayersList";
import { MultiBar } from "./MultiBar";
import { PanelEdge } from "./PanelEdge";
import { ShapePicker } from "./ShapePicker";
import { useLayerSelection } from "./selection";
import { useEditorCommands } from "./useEditorCommands";
import { usePanelWidths } from "./usePanelWidths";
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
  const selection = useLayerSelection();
  const panelWidths = usePanelWidths();
  const selectedId = selection.primary;
  const setSelectedId = (id: string | null) => selection.select(id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBrand, setShowBrand] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [overlay, setOverlay] = useState<"palette" | "shortcuts" | null>(null);
  const { editId, retarget, setStudio, studio, studioEditorFor } =
    useFrameStudio();
  const textEls = useRef(new Map<string, HTMLElement>());
  const latestItems = useRef(items);
  latestItems.current = items;
  const kitDoc = useActiveBrand()?.kit?.resolvedDoc ?? null;
  const palette = kitDoc?.palette ?? [];

  const frame = items.find((item) => item.id === frameId);
  const layers = frame ? layersOf(frame, items) : [];
  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const background = frame ? backgroundOf(frame, layers) : null;

  const cmd = useEditorCommands({
    background,
    brandFill: palette[0]?.value ?? "#e5e5e5",
    frame,
    items,
    kitDoc,
    layers,
    onChange,
    selection,
    setEditingId,
    ui: {
      close: onClose,
      openPalette: () => setOverlay("palette"),
      openShortcuts: () => setOverlay("shortcuts"),
      openStudio: () => setStudio("gradient"),
      toggleGenerate: () => setShowGenerate((v) => !v),
      toggleImages: () => setShowBrand((v) => !v),
      togglePanel: panelWidths.toggle,
    },
  });
  const { chosen, patch, patchMany } = cmd;
  const comps = useComponents({
    frame,
    items,
    onChange,
    select: selection.setIds,
  });

  // Keys, caught before the board's own so a Delete here never reaches the
  // board's selection. Esc lets go of the selection, then closes the editor.
  useShortcuts(cmd.commands, {
    onEscape: () =>
      selection.primary || chosen.length ? setSelectedId(null) : onClose(),
    // The palette and sheet close themselves; the Studio closes on Esc here.
    onPausedEscape: () => (overlay ? setOverlay(null) : setStudio(null)),
    paused: overlay !== null || studio !== null,
  });

  if (!frame) {
    return null;
  }

  const size = sizeFromTitle(frame.body);
  const name = frame.body?.trim() || "Untitled frame";

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
      className={panelWidths.className}
      data-frame-editor=""
      role="dialog"
      style={panelWidths.style}
    >
      <PanelEdge panels={panelWidths} side="left" />
      <PanelEdge panels={panelWidths} side="right" />
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
          <button
            aria-label="Command palette"
            className="creative__button creative__button--icon"
            onClick={() => setOverlay("palette")}
            title="Command palette (⌘K) · shortcuts (?)"
            type="button"
          >
            <CommandIcon size={15} />
          </button>
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
            onClick={() => cmd.text("headline")}
            title="Headline (T)"
            type="button"
          >
            <Type size={16} /> Headline
          </button>
          <button
            className="creative__add"
            onClick={() => cmd.text("body")}
            title="Body text (⇧T)"
            type="button"
          >
            <Type size={13} /> Body text
          </button>
          <ShapePicker onPick={cmd.shape} />
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
          <button
            aria-pressed={studio !== null}
            className="creative__add"
            onClick={() => setStudio((v) => (v ? null : "gradient"))}
            title="Backgrounds, patterns, shapes, colour and type (⇧S)"
            type="button"
          >
            <Palette size={16} /> Studio
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
        <ComponentsSection chosen={chosen} comps={comps} />
        <p className="creative__label">Layers</p>
        <LayersList
          layers={layers}
          onReorder={cmd.restack}
          onSelect={selection.select}
          selectedIds={selection.ids}
        />
      </aside>

      <main className="creative__main">
        {chosen.length > 1 ? (
          <MultiBar
            layers={chosen}
            onClear={() => selection.select(null)}
            onDelete={() => cmd.removeMany(chosen.map((l) => l.id))}
            onDuplicate={() => cmd.copyMany(chosen)}
            onPatch={patchMany}
            onToBoard={() => cmd.toBoard(chosen)}
          />
        ) : null}
        {chosen.length <= 1 && selected ? (
          <ContextBar
            frame={frame}
            item={selected}
            onDelete={() => cmd.removeMany([selected.id])}
            onDuplicate={() => cmd.copyMany([selected])}
            onEditInStudio={studioEditorFor(selected)}
            onPatch={(next) => patch(selected.id, next)}
            onReorder={(how) => cmd.order(selected.id, how)}
            onToBoard={() => cmd.toBoard([selected])}
          />
        ) : null}
        {chosen.length === 0 ? (
          <div className="creative__bar creative__bar--empty">
            Select a layer to style it, ⇧-click or drag a box to select several.
            Double-click text to edit. Arrows nudge, ⇧ for 10. ⌥-drag to
            duplicate, hold ⌘ to drag without snapping.
          </div>
        ) : null}
        <Artboard
          editingId={editingId}
          frame={frame}
          layers={layers}
          onCommit={patch}
          onCommitMany={patchMany}
          onCopyMoved={cmd.copyMoved}
          onDropFiles={onDropFiles}
          onEditText={setEditingId}
          onSelect={selection.select}
          onSelectMany={selection.setIds}
          onTextChange={(id, body) => patch(id, { body })}
          selectedIds={selection.ids}
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

      <EditorOverlays
        commands={cmd.commands}
        onCloseOverlay={() => setOverlay(null)}
        onCloseStudio={() => setStudio(null)}
        overlay={overlay}
        studio={frameStudioProps({
          add: cmd.add,
          applyType: cmd.applyTypeScale,
          editId,
          frame,
          items,
          layers,
          name,
          size,
          studio,
          swap: (oldId, next) => {
            // The latest board: the new picture uploads first, and the
            // board may have changed while it did.
            onChange(
              latestItems.current.map((i) => (i.id === oldId ? next : i))
            );
            selection.select(next.id);
            retarget(next.id);
          },
        })}
      />
      {showBrand ? (
        <BrandDock
          onClose={() => setShowBrand(false)}
          onInsert={(image) =>
            void aspectOf(image.imageUrl).then((aspect) =>
              cmd.add(newImage(frame, items, image.imageUrl, aspect))
            )
          }
        />
      ) : null}
    </div>
  );
}
