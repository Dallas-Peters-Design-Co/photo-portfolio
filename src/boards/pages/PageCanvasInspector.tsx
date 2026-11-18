import { Trash2 } from "lucide-react";
import { withStep } from "../../../config/conceptSteps.js";
import { linkStyle } from "../../../config/conceptStyle.js";
import { PageField, PageNumber, PageSelect } from "./PageFields";
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
    rootIndex,
    setElements,
    elements,
    selected,
    setSelected,
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
          <PageField label="Text">
            <textarea
              aria-label="Component text"
              className="page-builder__text"
              onChange={(e) => patchElement({ text: e.target.value })}
              rows={4}
              value={element.text}
            />
          </PageField>
          <div className="page-builder__numbers">
            <PageNumber
              label="Font size"
              max={72}
              min={10}
              onChange={(fontSize) => patchElement({ fontSize })}
              value={element.fontSize}
            />
            <PageNumber
              label="Radius"
              max={48}
              onChange={(radius) => patchElement({ radius })}
              value={element.radius}
            />
          </div>
          {(["color", "background"] as const).map((field) => (
            <PageField key={field} label={field}>
              <input
                aria-label={`Component ${field}`}
                className="page-builder__color"
                onChange={(e) => patchElement({ [field]: e.target.value })}
                type="color"
                value={
                  element[field].startsWith("#") ? element[field] : "#ffffff"
                }
              />
            </PageField>
          ))}
          {element.styleId ? (
            <button
              className="page-builder__button"
              onClick={() => {
                const style = doc?.componentStyles.find(
                  (s) => s.id === element.styleId
                );
                if (style) {
                  patchElement(
                    { ...linkStyle(element, style), overrides: [] },
                    true
                  );
                }
              }}
              type="button"
            >
              Reset to brand style
            </button>
          ) : null}
          {rootIndex >= 0 ? (
            <button
              className="page-builder__button"
              onClick={() => {
                setElements(elements.filter((e) => e.id !== selected));
                setSelected(null);
              }}
              type="button"
            >
              <Trash2 size={14} /> Remove component
            </button>
          ) : null}
        </>
      ) : (
        <p className="page-builder__hint">
          Select a component on the page or in Layers to edit its properties.
        </p>
      )}
    </aside>
  );
}
