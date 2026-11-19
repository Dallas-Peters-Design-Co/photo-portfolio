import { Trash2 } from "lucide-react";
import { withStep } from "../../../config/conceptSteps.js";
import { linkStyle } from "../../../config/conceptStyle.js";
import { layerDestination, layerSlots } from "../../../config/pageLayerMove.js";
import { workspaceGrid } from "../../../config/pageWorkspaceGrid.js";
import { ConceptFlexFields } from "../../components/admin/ConceptFlexFields";
import { ConceptColorField } from "../../components/admin/ReviewConceptBrand";
import { ReviewConceptElementFields } from "../../components/admin/ReviewConceptElementFields";
import "../../components/admin/ReviewConceptsEditor.css";
import { PageNumber, PageSelect } from "./PageFields";
import { PageFrameGridFields, PageGridPlacement } from "./PageFrameGridFields";
import { PageTooltipFields } from "./PageTooltipFields";
import type { usePageCanvas } from "./usePageCanvas";

const NONE = "none";
const ANIMATIONS = [
  "fade",
  "rise",
  "drop",
  "from-right",
  "from-left",
  "pop",
] as const;
function PlacementFields({
  editor,
}: {
  editor: ReturnType<typeof usePageCanvas>;
}) {
  const { element, box, setBox, patchElement } = editor;
  if (!element) {
    return null;
  }
  if (box && editor.page.grid?.enabled) {
    return (
      <>
        <PageGridPlacement
          elements={editor.step?.elements ?? []}
          grid={editor.page.grid}
          id={element.id}
          save={(grid) => editor.write({ ...editor.resolved, grid })}
        />
        {element.kind === "panel" && (
          <PageNumber
            label="Open panel width"
            min={1}
            onChange={(width) => setBox(element.id, { ...box, width })}
            value={box.width}
          />
        )}
      </>
    );
  }
  if (box) {
    const fields = element.fullHeight
      ? (["x", "y", "width"] as const)
      : (["x", "y", "width", "height"] as const);
    return (
      <div className="page-builder__numbers">
        {fields.map((field) => (
          <PageNumber
            key={field}
            label={field.toUpperCase()}
            min={field === "width" || field === "height" ? 1 : 0}
            onChange={(value) => setBox(element.id, { ...box, [field]: value })}
            value={box[field]}
          />
        ))}
      </div>
    );
  }
  if (element.kind !== "canvas" && element.kind !== "shader") {
    return null;
  }
  const canvasSize = element.canvasSize ??
    element.canvasComponent ?? { height: 240, width: 360 };
  return (
    <div className="page-builder__numbers">
      {(["width", "height"] as const).map((field) => (
        <PageNumber
          key={field}
          label={field.toUpperCase()}
          min={1}
          onChange={(value) =>
            patchElement({
              canvasSize: {
                height: canvasSize.height,
                width: canvasSize.width,
                [field]: value,
              },
            })
          }
          value={canvasSize[field]}
        />
      ))}
    </div>
  );
}

function LayerDestination({
  editor,
  id,
}: {
  editor: ReturnType<typeof usePageCanvas>;
  id: string;
}) {
  const options = editor.all.flatMap((layer, index) => {
    const positions =
      layer.kind === "group" ? ["inside" as const] : layerSlots(layer.kind);
    const label =
      layer.text.split("\n")[0].trim() || `${layer.kind} ${index + 1}`;
    return positions
      .filter((position) =>
        layerDestination(editor.elements, id, layer.id, position)
      )
      .map((position) => ({
        label: position === "inside" ? label : `${label} · ${position}`,
        position,
        target: layer.id,
        value: `${layer.id}/${position}`,
      }));
  });
  return options.length ? (
    <PageSelect
      label="Move to group or slot"
      onChange={(key) => {
        const dest = options.find((o) => o.value === key);
        if (dest) {
          editor.moveLayer(id, dest.target, dest.position);
        }
      }}
      options={[{ label: "Choose destination…", value: "" }, ...options]}
      value=""
    />
  ) : null;
}

export function PageCanvasInspector({
  editor,
}: {
  editor: ReturnType<typeof usePageCanvas>;
}) {
  const {
    page,
    resolved,
    concept,
    step,
    steps,
    all,
    at,
    element,
    box,
    doc,
    removeSelected,
    write,
    patchElement,
  } = editor;
  const isArtwork = ["canvas", "shader"].includes(element?.kind ?? "");
  return (
    <aside className="page-builder__inspector">
      <h2>Page</h2>
      <PageFrameGridFields
        grid={page.grid}
        save={(grid) => write({ ...resolved, grid })}
        workspace={workspaceGrid(page, step?.elements ?? [])}
      />
      <div className="page-builder__numbers">
        <PageNumber
          label="Page width"
          max={4096}
          min={320}
          onChange={(width) => write({ ...resolved, width })}
          value={page.width}
        />
        <PageNumber
          label="Page height"
          min={200}
          onChange={(height) => write({ ...resolved, height })}
          value={page.height}
        />
      </div>
      <ConceptColorField
        allowNone
        ariaLabel="Page background"
        brandDoc={doc}
        label="Page background"
        onChange={(background) =>
          write({ ...resolved, concept: { ...concept, background } })
        }
        value={concept.background}
      />
      {step && steps.length > 1 ? (
        <>
          <h2>Interaction</h2>
          <PageSelect
            label="Click to next state"
            onChange={(id) =>
              write({
                ...resolved,
                concept: withStep(concept, at, {
                  ...step,
                  trigger: id === NONE ? undefined : id,
                }),
              })
            }
            options={[
              { label: "Use Next", value: NONE },
              ...all.map((el) => ({
                label: `${el.kind} · ${el.text || "Untitled"}`,
                value: el.id,
              })),
            ]}
            value={step.trigger ?? NONE}
          />
          <PageSelect
            label="Animate in"
            onChange={(id) =>
              write({
                ...resolved,
                concept: withStep(concept, at, {
                  ...step,
                  enter:
                    id === NONE
                      ? undefined
                      : {
                          animation: step.enter?.animation ?? "fade",
                          element: id,
                        },
                }),
              })
            }
            options={[
              { label: "No animation", value: NONE },
              ...all.map((el) => ({
                label: `${el.kind} · ${el.text || "Untitled"}`,
                value: el.id,
              })),
            ]}
            value={step.enter?.element ?? NONE}
          />
          {step.enter ? (
            <PageSelect
              label="Animation"
              onChange={(animation) =>
                write({
                  ...resolved,
                  concept: withStep(concept, at, {
                    ...step,
                    enter: {
                      animation: animation as (typeof ANIMATIONS)[number],
                      element: step.enter?.element ?? "",
                    },
                  }),
                })
              }
              options={ANIMATIONS.map((a) => ({ label: a, value: a }))}
              value={step.enter.animation}
            />
          ) : null}
        </>
      ) : null}
      <h2>{element ? element.kind : "Properties"}</h2>
      {element ? (
        <>
          <PlacementFields editor={editor} />
          <LayerDestination editor={editor} id={element.id} />
          {element.kind === "group" && (
            <button
              className="page-builder__button"
              onClick={editor.ungroupSelected}
              type="button"
            >
              Ungroup
            </button>
          )}
          {editor.canGroup ? (
            <button
              className="page-builder__button"
              onClick={editor.groupSelected}
              type="button"
            >
              Wrap in layout group
            </button>
          ) : null}
          {editor.moveIntoGroup ? (
            <button
              className="page-builder__button"
              onClick={editor.moveIntoGroup}
              type="button"
            >
              Move into group above
            </button>
          ) : null}
          <button
            className="page-builder__button"
            onClick={removeSelected}
            type="button"
          >
            <Trash2 size={14} /> {box ? "Remove component" : "Remove item"}
          </button>
          {isArtwork ? (
            <>
              <ConceptFlexFields
                flex={element.flex}
                onChange={(flex) => patchElement({ flex })}
              />
              <PageTooltipFields
                doc={doc}
                element={element}
                onChange={patchElement}
              />
            </>
          ) : (
            <ReviewConceptElementFields
              brandDoc={doc}
              element={element}
              initiallyOpen
              key={element.id}
              onChange={patchElement}
              onLink={(style) =>
                patchElement(
                  {
                    ...linkStyle(element, style),
                    overrides: [],
                    styleId: style?.id,
                  },
                  true
                )
              }
              styles={doc?.componentStyles.filter(
                (style) => style.kind === element.kind
              )}
            />
          )}
        </>
      ) : (
        <p className="page-builder__hint">
          Select a component on the page or in Layers to edit its properties.
        </p>
      )}
    </aside>
  );
}
