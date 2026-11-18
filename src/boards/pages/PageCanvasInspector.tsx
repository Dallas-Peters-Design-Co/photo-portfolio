import { Trash2 } from "lucide-react";
import { withStep } from "../../../config/conceptSteps.js";
import { linkStyle } from "../../../config/conceptStyle.js";
import { ConceptFlexFields } from "../../components/admin/ConceptFlexFields";
import { ReviewConceptElementFields } from "../../components/admin/ReviewConceptElementFields";
import "../../components/admin/ReviewConceptsEditor.css";
import { PageField, PageNumber, PageSelect } from "./PageFields";
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
    setBox,
    doc,
    removeSelected,
    write,
    patchElement,
  } = editor;
  return (
    <aside className="page-builder__inspector">
      <h2>Page</h2>
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
      <PageField label="Page background">
        <input
          aria-label="Page background"
          className="page-builder__color"
          onChange={(e) =>
            write({
              ...resolved,
              concept: { ...concept, background: e.target.value },
            })
          }
          type="color"
          value={concept.background}
        />
      </PageField>
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
          {box ? (
            <div className="page-builder__numbers">
              {(["x", "y", "width", "height"] as const).map((field) => (
                <PageNumber
                  key={field}
                  label={field.toUpperCase()}
                  min={field === "width" || field === "height" ? 1 : 0}
                  onChange={(value) =>
                    setBox(element.id, { ...box, [field]: value })
                  }
                  value={box[field]}
                />
              ))}
            </div>
          ) : null}
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
          {element.kind === "canvas" ? (
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
