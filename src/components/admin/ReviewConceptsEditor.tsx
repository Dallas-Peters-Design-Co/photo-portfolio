import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import { MAX_REVIEW_CONCEPTS } from "../../../config/reviewConcept.js";
import { loadFontRef } from "../../theme/remoteFonts";
import { ReviewConceptElementView } from "../review/ReviewConceptElementView";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { ConceptFontField, conceptFontCss } from "./ConceptFontField";
import {
  ConceptColorField,
  createConcept,
  createConceptElement,
} from "./ReviewConceptBrand";
import "./ReviewConceptsEditor.css";

const ALIGN_ITEMS = {
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
} as const;

const numberInput = (
  label: string,
  value: number,
  onChange: (value: number) => void,
  max: number
) => (
  <label className="review-concepts__field">
    <span>{label}</span>
    <input
      max={max}
      min={0}
      onChange={(event) => onChange(Number(event.target.value))}
      type="number"
      value={value}
    />
  </label>
);

function ConceptCard({
  brandDoc,
  concept,
  onChange,
  onRemove,
}: {
  brandDoc?: BrandKitDoc | null;
  concept: ReviewConcept;
  onChange: (next: ReviewConcept) => void;
  onRemove: () => void;
}) {
  const updateElement = (id: string, patch: Partial<ReviewConceptElement>) =>
    onChange({
      ...concept,
      elements: concept.elements.map((element) =>
        element.id === id ? { ...element, ...patch } : element
      ),
    });

  const addElement = (kind: ReviewConceptElementKind) =>
    onChange({
      ...concept,
      elements: [...concept.elements, createConceptElement(kind, brandDoc)],
    });

  useEffect(() => {
    if (concept.fontRef) {
      loadFontRef(concept.fontRef);
    }
    for (const element of concept.elements) {
      if (element.fontRef) {
        loadFontRef(element.fontRef);
      }
    }
  }, [concept]);

  const previewStyle = {
    alignItems: ALIGN_ITEMS[concept.align],
    background: concept.background,
    borderRadius: concept.radius,
    color: concept.color,
    display: "flex",
    flexDirection: concept.direction,
    fontFamily: conceptFontCss(
      concept.fontFamily,
      concept.fontRef,
      concept.fontId
    ),
    gap: concept.gap,
    padding: concept.padding,
  } as const;

  return (
    <article className="review-concepts__card">
      <header className="review-concepts__card-head">
        <input
          aria-label="Concept name"
          className="review-concepts__title"
          onChange={(event) =>
            onChange({ ...concept, title: event.target.value })
          }
          placeholder="Name this concept"
          value={concept.title}
        />
        <Button
          aria-label={`Remove ${concept.title || "concept"}`}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 size={14} />
        </Button>
      </header>

      <div className="review-concepts__workspace">
        <div className="review-concepts__preview-wrap">
          <p>Live preview</p>
          <div className="review-concepts__preview" style={previewStyle}>
            {concept.elements.map((element) => (
              <ReviewConceptElementView element={element} key={element.id} />
            ))}
          </div>
        </div>
        <div className="review-concepts__controls">
          <div className="review-concepts__control-grid">
            <label className="review-concepts__field">
              <span>Auto layout</span>
              <select
                onChange={(event) =>
                  onChange({
                    ...concept,
                    direction: event.target.value === "row" ? "row" : "column",
                  })
                }
                value={concept.direction}
              >
                <option value="column">Vertical</option>
                <option value="row">Horizontal</option>
              </select>
            </label>
            <label className="review-concepts__field">
              <span>Align items</span>
              <select
                onChange={(event) =>
                  onChange({
                    ...concept,
                    align: event.target.value as ReviewConcept["align"],
                  })
                }
                value={concept.align}
              >
                <option value="start">Start</option>
                <option value="center">Center</option>
                <option value="end">End</option>
                <option value="stretch">Stretch</option>
              </select>
            </label>
            {numberInput(
              "Gap",
              concept.gap,
              (gap) => onChange({ ...concept, gap }),
              64
            )}
            {numberInput(
              "Padding",
              concept.padding,
              (padding) => onChange({ ...concept, padding }),
              96
            )}
            {numberInput(
              "Corner radius",
              concept.radius,
              (radius) => onChange({ ...concept, radius }),
              64
            )}
            <ConceptFontField
              brandDoc={brandDoc}
              family={concept.fontFamily}
              fontId={concept.fontId}
              fontRef={concept.fontRef}
              onChange={(patch) => onChange({ ...concept, ...patch })}
            />
            <ConceptColorField
              ariaLabel="Concept background"
              brandDoc={brandDoc}
              label="Background"
              onChange={(background) => onChange({ ...concept, background })}
              value={concept.background}
            />
            <ConceptColorField
              ariaLabel="Concept text color"
              brandDoc={brandDoc}
              label="Text color"
              onChange={(color) => onChange({ ...concept, color })}
              value={concept.color}
            />
          </div>

          <div className="review-concepts__elements">
            <div className="review-concepts__element-head">
              <Label>Elements</Label>
              <div className="review-concepts__add-actions">
                <select
                  aria-label="Add a component"
                  className="review-concepts__add-select"
                  onChange={(event) => {
                    if (event.target.value) {
                      addElement(
                        event.target.value as ReviewConceptElementKind
                      );
                      event.target.value = "";
                    }
                  }}
                  value=""
                >
                  <option disabled value="">
                    + Add component
                  </option>
                  <option value="text">Text</option>
                  <option value="button">Button</option>
                  <option value="input">Input</option>
                  <option value="textarea">Text area</option>
                  <option value="select">Select</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="card">Card</option>
                  <option value="label">Label</option>
                  <option value="badge">Badge</option>
                  <option value="link">Link</option>
                  <option value="divider">Divider</option>
                  <option value="tabs">Tabs</option>
                  <option value="table">Table</option>
                  <option value="dialog">Dialog</option>
                  <option value="menu">Dropdown menu</option>
                  <option value="toast">Toast</option>
                  <option value="skeleton">Skeleton loader</option>
                </select>
              </div>
            </div>
            {concept.elements.map((element) => (
              <fieldset className="review-concepts__element" key={element.id}>
                <legend>{element.kind}</legend>
                <div className="review-concepts__element-grid">
                  <label className="review-concepts__field review-concepts__field--wide">
                    <span>
                      {element.kind === "input" || element.kind === "textarea"
                        ? "Default value"
                        : "Content"}
                    </span>
                    <input
                      onChange={(event) =>
                        updateElement(element.id, { text: event.target.value })
                      }
                      value={element.text}
                    />
                  </label>
                  {element.kind === "input" || element.kind === "textarea" ? (
                    <label className="review-concepts__field review-concepts__field--wide">
                      <span>Placeholder</span>
                      <input
                        onChange={(event) =>
                          updateElement(element.id, {
                            placeholder: event.target.value,
                          })
                        }
                        value={element.placeholder ?? ""}
                      />
                    </label>
                  ) : null}
                  {["select", "tabs", "table", "menu"].includes(
                    element.kind
                  ) ? (
                    <label className="review-concepts__field review-concepts__field--wide">
                      <span>Options, comma separated</span>
                      <input
                        onChange={(event) =>
                          updateElement(element.id, {
                            options: event.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean)
                              .slice(0, 8),
                          })
                        }
                        value={(element.options ?? []).join(", ")}
                      />
                    </label>
                  ) : null}
                  {element.kind === "input" ? (
                    <label className="review-concepts__field">
                      <span>Input type</span>
                      <select
                        onChange={(event) =>
                          updateElement(element.id, {
                            inputType: event.target
                              .value as ReviewConceptElement["inputType"],
                          })
                        }
                        value={element.inputType ?? "text"}
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="search">Search</option>
                        <option value="url">URL</option>
                        <option value="tel">Phone</option>
                        <option value="password">Password</option>
                      </select>
                    </label>
                  ) : null}
                  <label className="review-concepts__field">
                    <span>Type size</span>
                    <input
                      max={72}
                      min={10}
                      onChange={(event) =>
                        updateElement(element.id, {
                          fontSize: Number(event.target.value),
                        })
                      }
                      type="number"
                      value={element.fontSize}
                    />
                  </label>
                  <label className="review-concepts__field">
                    <span>Weight</span>
                    <select
                      onChange={(event) =>
                        updateElement(element.id, {
                          fontWeight: Number(
                            event.target.value
                          ) as ReviewConceptElement["fontWeight"],
                        })
                      }
                      value={element.fontWeight}
                    >
                      <option value={400}>Regular</option>
                      <option value={500}>Medium</option>
                      <option value={600}>Semibold</option>
                      <option value={700}>Bold</option>
                    </select>
                  </label>
                  <ConceptFontField
                    brandDoc={brandDoc}
                    family={element.fontFamily}
                    fontId={element.fontId}
                    fontRef={element.fontRef}
                    label="Typeface"
                    onChange={(patch) => updateElement(element.id, patch)}
                  />
                  {numberInput(
                    "Line height",
                    element.lineHeight,
                    (lineHeight) => updateElement(element.id, { lineHeight }),
                    2.4
                  )}
                  {numberInput(
                    "Radius",
                    element.radius,
                    (radius) => updateElement(element.id, { radius }),
                    48
                  )}
                  {numberInput(
                    "Horizontal padding",
                    element.paddingX,
                    (paddingX) => updateElement(element.id, { paddingX }),
                    48
                  )}
                  {numberInput(
                    "Vertical padding",
                    element.paddingY,
                    (paddingY) => updateElement(element.id, { paddingY }),
                    32
                  )}
                  <ConceptColorField
                    ariaLabel={`${element.kind} text color`}
                    brandDoc={brandDoc}
                    label="Text color"
                    onChange={(color) => updateElement(element.id, { color })}
                    value={element.color}
                  />
                  {element.background === "transparent" ? null : (
                    <ConceptColorField
                      ariaLabel={`${element.kind} background`}
                      brandDoc={brandDoc}
                      label="Fill"
                      onChange={(background) =>
                        updateElement(element.id, { background })
                      }
                      value={element.background}
                    />
                  )}
                  {element.kind === "checkbox" ? (
                    <label className="review-concepts__field">
                      <span>Checked</span>
                      <input
                        checked={element.checked ?? false}
                        onChange={(event) =>
                          updateElement(element.id, {
                            checked: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                    </label>
                  ) : null}
                  <Button
                    aria-label={`Remove ${element.kind}`}
                    onClick={() =>
                      onChange({
                        ...concept,
                        elements: concept.elements.filter(
                          (item) => item.id !== element.id
                        ),
                      })
                    }
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ReviewConceptsEditor({
  brandDoc,
  concepts,
  maxConcepts = MAX_REVIEW_CONCEPTS,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  concepts: ReviewConcept[];
  maxConcepts?: number;
  onChange: (concepts: ReviewConcept[]) => void;
}) {
  const update = (id: string, next: ReviewConcept) =>
    onChange(concepts.map((concept) => (concept.id === id ? next : concept)));

  return (
    <section className="review-concepts-editor">
      <div className="review-concepts-editor__head">
        <div>
          <h3>Here’s what it could look like</h3>
          <p>Sketch how this recommendation could appear on the page.</p>
        </div>
        <Button
          disabled={concepts.length >= maxConcepts}
          onClick={() => onChange([...concepts, createConcept(brandDoc)])}
          type="button"
          variant="outline"
        >
          <Plus size={14} /> Add concept
        </Button>
      </div>
      {concepts.length === 0 ? (
        <p className="review-concepts-editor__empty">
          No concepts yet. Add one to sketch a component, call to action, or
          small page section.
        </p>
      ) : (
        <div className="review-concepts-editor__list">
          {concepts.map((concept) => (
            <ConceptCard
              brandDoc={brandDoc}
              concept={concept}
              key={concept.id}
              onChange={(next) => update(concept.id, next)}
              onRemove={() =>
                onChange(concepts.filter((item) => item.id !== concept.id))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
