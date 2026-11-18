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
import { CanvasComponentKit } from "../../components/admin/ReviewCanvasComponents";
import type { BoardItem } from "../../types";
import { PanelEdge } from "../creative/PanelEdge";
import { usePanelWidths } from "../creative/usePanelWidths";
import { PageCanvasInspector } from "./PageCanvasInspector";
import { PageCanvasStage } from "./PageCanvasStage";
import { PageDesignView } from "./PageDesignView";
import { PageSelect } from "./PageFields";
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
    all,
    write,
    resolved,
    add,
    addStep,
    removeState,
    setBox,
  } = editor;
  return (
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
      <aside className="page-builder__library">
        <PageSelect
          label="Brand kit"
          onChange={(id) =>
            write({ ...resolved, kitId: id === NONE ? null : id })
          }
          options={[
            { label: "No brand kit", value: NONE },
            ...(brand?.kits ?? []).map((k) => ({ label: k.name, value: k.id })),
          ]}
          value={page.kitId ?? NONE}
        />
        <h2>Components</h2>
        {doc?.componentStyles.map((style) => (
          <button
            className="page-builder__insert"
            disabled={elements.length >= MAX_CONCEPT_ELEMENTS || playing}
            key={style.id}
            onClick={() => add(style.id)}
            type="button"
          >
            <Plus size={14} />
            {style.name}
            <span>{style.kind}</span>
          </button>
        ))}
        {canvasComponents.map((component) => (
          <button
            className="page-builder__insert"
            disabled={elements.length >= MAX_CONCEPT_ELEMENTS || playing}
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
            ...ELEMENT_KINDS.filter((kind) => kind !== "canvas").map(
              (kind) => ({
                label: kind === "group" ? "Layout group" : kind,
                value: kind,
              })
            ),
          ]}
          value={NONE}
        />
        <h2>Layers</h2>
        {all.map((el) => (
          <button
            aria-pressed={selected === el.id}
            className="page-builder__layer"
            key={el.id}
            onClick={() => {
              setSelected(el.id);
              setPlaying(false);
            }}
            type="button"
          >
            {el.kind}
            <span>{el.text.split("\n")[0] || "Untitled"}</span>
          </button>
        ))}
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
        <PageCanvasInspector editor={editor} />
      </CanvasComponentKit.Provider>
    </div>
  );
}
