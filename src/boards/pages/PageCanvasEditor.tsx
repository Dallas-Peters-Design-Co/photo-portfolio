import { paletteProperties } from "../../../config/paletteBinding.js";
import "@fontsource-variable/public-sans/wght.css";
import "@fontsource/archivo/latin-600.css";
import { ArrowLeft, Copy, Play, Plus, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { MAX_CONCEPT_STEPS } from "../../../config/conceptSteps.js";
import type { PageDesign } from "../../../config/pageDesign.js";
import {
  ELEMENT_KINDS,
  MAX_CONCEPT_ELEMENTS,
} from "../../../config/reviewConcept.js";
import { KitStyleSyncProvider } from "../../components/admin/kitStyleSync";
import { CanvasComponentKit } from "../../components/admin/ReviewCanvasComponents";
import type { BoardItem } from "../../types";
import { PanelEdge } from "../creative/PanelEdge";
import { usePanelWidths } from "../creative/usePanelWidths";
import {
  ALL_SHADERS,
  newLayerId,
  newShaderConfig,
} from "../shaders/shaderConfig";
import { PageCanvasInspector } from "./PageCanvasInspector";
import { PageCanvasStage } from "./PageCanvasStage";
import { PageDesignView } from "./PageDesignView";
import { PageSelect } from "./PageFields";
import { PageKitVariants } from "./PageKitVariants";
import { LayerDragProvider } from "./PageLayerDrag";
import { PageLayerList } from "./PageLayerList";
import { libraryDrag, libraryDrop } from "./pageLibraryDrag";
import { usePageCanvas } from "./usePageCanvas";
import { usePageEditorDialog } from "./usePageEditorDialog";
import "./PageCanvasEditor.css";

const NONE = "none";
export function PageCanvasEditor({
  frame,
  onChange,
  onClose,
}: {
  frame: BoardItem;
  onChange: (page: PageDesign) => void;
  onClose: () => void;
}) {
  const editor = usePageCanvas(frame, onChange);
  const widths = usePanelWidths("page-builder:panels", 0.32);
  const dialog = usePageEditorDialog(onClose);
  const {
    brand,
    canvasComponents,
    canvasError,
    page,
    doc,
    elements,
    selected,
    setSelected,
    playing,
    setPlaying,
    steps,
    at,
    setIndex,
    reorderLayers,
    write,
    resolved,
    add,
    addStep,
    removeState,
    setBox,
  } = editor;
  const builder = (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the dialog scopes editor shortcuts away from the board
    <div
      aria-label={`Build page ${frame.body || "Page"}`}
      aria-modal="true"
      className="page-builder"
      data-frame-editor=""
      data-surface="board"
      onKeyDown={dialog.onKeyDown}
      ref={dialog.ref}
      role="dialog"
      style={
        {
          ...paletteProperties(doc?.palette),
          "--inspector-width": `${widths.panels.right}px`,
          "--library-width": `${widths.panels.left}px`,
        } as CSSProperties
      }
    >
      <header className="page-builder__header">
        <button
          className="page-builder__button"
          onClick={onClose}
          type="button"
        >
          <ArrowLeft size={15} /> Done
        </button>
        <strong>{frame.body || "Page"}</strong>
        <span className="page-builder__readout">
          {page.width} × {page.height}
        </span>
        <button
          aria-pressed={playing}
          className="page-builder__button"
          onClick={() => setPlaying(!playing)}
          type="button"
        >
          <Play size={15} />
          {playing ? "Edit page" : "Play"}
        </button>
      </header>
      <aside className="page-builder__library" data-sortable-scroll="">
        <PageSelect
          label="Brand kit"
          onChange={(id) =>
            write({ ...resolved, kitId: id === NONE ? null : id })
          }
          options={[
            { label: "No brand kit", value: NONE },
            ...(brand?.kits ?? []).map((k) => ({
              label: k.name,
              value: k.id,
            })),
          ]}
          value={page.kitId ?? NONE}
        />
        <h2>Components</h2>
        <PageKitVariants
          disabled={elements.length >= MAX_CONCEPT_ELEMENTS || playing}
          key={page.kitId}
          onInsert={add}
          styles={doc?.componentStyles ?? []}
        />
        {canvasComponents.map((component) => (
          <button
            className="page-builder__insert"
            disabled={elements.length >= MAX_CONCEPT_ELEMENTS || playing}
            {...libraryDrag(`canvas:${component.id}`)}
            key={component.id}
            onClick={() => add(`canvas:${component.id}`)}
            type="button"
          >
            <Plus size={14} />
            {component.name}
            <span>canvas</span>
          </button>
        ))}
        {canvasError ? (
          <p className="page-builder__hint" role="status">
            Couldn't load canvas components.
          </p>
        ) : null}
        {doc?.componentStyles.length || canvasComponents.length ? null : (
          <p className="page-builder__hint">
            Choose a brand kit to insert its components. Basic elements are
            available below.
          </p>
        )}
        <PageSelect
          label="Basic element"
          onChange={(kind) => {
            if (kind !== NONE) {
              add(kind);
            }
          }}
          options={[
            { label: "Add an element…", value: NONE },
            { label: "Stateful component", value: "stateful-component" },
            ...ELEMENT_KINDS.filter(
              (kind) => kind !== "canvas" && kind !== "shader"
            ).map((kind) => ({
              label: kind === "group" ? "Layout group" : kind,
              value: kind,
            })),
          ]}
          value={NONE}
        />
        {!playing && elements.length < MAX_CONCEPT_ELEMENTS && (
          <PageSelect
            label="Insert shader"
            onChange={(value) => {
              const saved = doc?.shaders.find((s) => `kit:${s.id}` === value);
              if (saved) {
                add("shader", saved);
              } else if (ALL_SHADERS.some((s) => s.name === value)) {
                add("shader", {
                  id: newLayerId(),
                  name: value,
                  ...newShaderConfig(value),
                });
              }
            }}
            options={[
              { label: "Choose a shader…", value: NONE },
              ...(doc?.shaders ?? []).map((s) => ({
                label: `${s.name} · Kit`,
                value: `kit:${s.id}`,
              })),
              ...ALL_SHADERS.map((s) => ({ label: s.name, value: s.name })),
            ]}
            value={NONE}
          />
        )}
        <h2>Layers</h2>
        {elements.length > 1 && (
          <p className="page-builder__hint">
            Page layers stack from back to front.
          </p>
        )}
        <div className="page-builder__layers">
          <PageLayerList
            elements={elements}
            onChange={reorderLayers}
            onSelect={(id) => {
              setSelected(id);
              setPlaying(false);
            }}
            onUngroup={editor.ungroupLayer}
            selected={selected}
          />
        </div>
      </aside>
      <PanelEdge label="component library" panels={widths} side="left" />
      <main className="page-builder__main">
        <nav aria-label="Page states" className="page-builder__steps">
          {steps.map((s, i) => (
            <button
              aria-pressed={at === i}
              className="page-builder__button"
              key={s.id}
              onClick={() => {
                setIndex(i);
                setSelected(null);
                setPlaying(false);
              }}
              type="button"
            >
              State {i + 1}
            </button>
          ))}
          <button
            className="page-builder__button"
            disabled={steps.length >= MAX_CONCEPT_STEPS}
            onClick={addStep}
            type="button"
          >
            <Copy size={14} /> Add state
          </button>
          <button
            className="page-builder__button"
            disabled={at === 0}
            onClick={removeState}
            type="button"
          >
            <Trash2 size={14} /> Remove state
          </button>
        </nav>
        <p className="page-builder__hint">
          {playing
            ? "Try the controls in the page. Back and Next move between states."
            : "Drag to move. Drag the corner to resize. Arrow keys nudge; Shift moves 10 px."}
        </p>
        <div
          className="page-builder__workspace"
          onPointerDown={(event) => {
            if (
              !playing &&
              event.button === 0 &&
              event.target instanceof Element &&
              !event.target.closest(".page-design__component, button")
            ) {
              setSelected(null);
            }
          }}
        >
          <div
            {...(playing
              ? {}
              : libraryDrop(Boolean(page.grid?.enabled), (value, placement) => {
                  if (
                    doc?.componentStyles.some((style) => style.id === value) ||
                    canvasComponents.some(
                      (component) => `canvas:${component.id}` === value
                    )
                  ) {
                    add(value, undefined, placement);
                  }
                }))}
            className="page-builder__screen"
            style={{ maxWidth: page.width }}
          >
            {playing ? (
              <PageDesignView page={resolved} />
            ) : (
              <PageCanvasStage
                onBox={setBox}
                onSelect={setSelected}
                page={resolved}
                selected={selected}
                stepIndex={at}
              />
            )}
          </div>
        </div>
      </main>
      <PanelEdge label="inspector" panels={widths} side="right" />
      <CanvasComponentKit.Provider value={page.kitId}>
        <KitStyleSyncProvider kitId={page.kitId}>
          <PageCanvasInspector editor={editor} />
        </KitStyleSyncProvider>
      </CanvasComponentKit.Provider>
    </div>
  );
  return (
    <LayerDragProvider move={editor.moveLayer}>{builder}</LayerDragProvider>
  );
}
