import { Plus, Trash2 } from "lucide-react";
import { newItemId } from "../../../config/proposal.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "../../../config/review.js";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import "./ReviewConceptsEditor.css";

const MAX_CONCEPTS = 8;
const FONT_FAMILIES = {
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "var(--font-sans, Arial, sans-serif)",
  serif: "Georgia, serif",
} as const;
const ALIGN_ITEMS = {
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
} as const;

const newElement = (kind: ReviewConceptElementKind): ReviewConceptElement => ({
  background: kind === "button" ? "#172033" : "transparent",
  color: kind === "button" ? "#ffffff" : "#172033",
  fontFamily: "sans",
  fontSize: kind === "button" ? 14 : 28,
  fontWeight: kind === "button" ? 600 : 700,
  id: newItemId(),
  kind,
  lineHeight: 1.25,
  paddingX: kind === "button" ? 18 : 0,
  paddingY: kind === "button" ? 11 : 0,
  radius: kind === "button" ? 6 : 0,
  text: kind === "button" ? "Get started" : "A better way to work",
});

const newConcept = (): ReviewConcept => ({
  align: "start",
  background: "#f2f4f7",
  color: "#172033",
  direction: "column",
  elements: [newElement("text"), newElement("button")],
  fontFamily: "sans",
  gap: 12,
  id: newItemId(),
  padding: 24,
  radius: 12,
  title: "Homepage hero",
});

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
  concept,
  onChange,
  onRemove,
}: {
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
    onChange({ ...concept, elements: [...concept.elements, newElement(kind)] });

  const previewStyle = {
    alignItems: ALIGN_ITEMS[concept.align],
    background: concept.background,
    borderRadius: concept.radius,
    color: concept.color,
    display: "flex",
    flexDirection: concept.direction,
    fontFamily: FONT_FAMILIES[concept.fontFamily],
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
            <label className="review-concepts__field">
              <span>Typeface</span>
              <select
                onChange={(event) =>
                  onChange({
                    ...concept,
                    fontFamily: event.target
                      .value as ReviewConcept["fontFamily"],
                  })
                }
                value={concept.fontFamily}
              >
                <option value="sans">Sans serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </label>
            <label className="review-concepts__field review-concepts__field--color">
              <span>Background</span>
              <input
                aria-label="Concept background"
                onChange={(event) =>
                  onChange({ ...concept, background: event.target.value })
                }
                type="color"
                value={concept.background}
              />
            </label>
            <label className="review-concepts__field review-concepts__field--color">
              <span>Text color</span>
              <input
                aria-label="Concept text color"
                onChange={(event) =>
                  onChange({ ...concept, color: event.target.value })
                }
                type="color"
                value={concept.color}
              />
            </label>
          </div>

          <div className="review-concepts__elements">
            <div className="review-concepts__element-head">
              <Label>Elements</Label>
              <div className="review-concepts__add-actions">
                <Button
                  onClick={() => addElement("text")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus size={13} /> Text
                </Button>
                <Button
                  onClick={() => addElement("button")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus size={13} /> Button
                </Button>
              </div>
            </div>
            {concept.elements.map((element) => (
              <fieldset className="review-concepts__element" key={element.id}>
                <legend>{element.kind === "button" ? "Button" : "Text"}</legend>
                <div className="review-concepts__element-grid">
                  <label className="review-concepts__field review-concepts__field--wide">
                    <span>Content</span>
                    <input
                      onChange={(event) =>
                        updateElement(element.id, { text: event.target.value })
                      }
                      value={element.text}
                    />
                  </label>
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
                  <label className="review-concepts__field">
                    <span>Typeface</span>
                    <select
                      onChange={(event) =>
                        updateElement(element.id, {
                          fontFamily: event.target
                            .value as ReviewConceptElement["fontFamily"],
                        })
                      }
                      value={element.fontFamily}
                    >
                      <option value="sans">Sans serif</option>
                      <option value="serif">Serif</option>
                      <option value="mono">Monospace</option>
                    </select>
                  </label>
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
                  <label className="review-concepts__field review-concepts__field--color">
                    <span>Text color</span>
                    <input
                      aria-label={`${element.kind} text color`}
                      onChange={(event) =>
                        updateElement(element.id, { color: event.target.value })
                      }
                      type="color"
                      value={element.color}
                    />
                  </label>
                  {element.kind === "button" ? (
                    <label className="review-concepts__field review-concepts__field--color">
                      <span>Fill</span>
                      <input
                        aria-label="Button fill"
                        onChange={(event) =>
                          updateElement(element.id, {
                            background: event.target.value,
                          })
                        }
                        type="color"
                        value={
                          element.background === "transparent"
                            ? "#ffffff"
                            : element.background
                        }
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

        <div className="review-concepts__preview-wrap">
          <p>Live preview</p>
          <div className="review-concepts__preview" style={previewStyle}>
            {concept.elements.map((element) => (
              <div
                key={element.id}
                style={{
                  background: element.background,
                  borderRadius: element.radius,
                  color: element.color,
                  fontFamily: FONT_FAMILIES[element.fontFamily],
                  fontSize: element.fontSize,
                  fontWeight: element.fontWeight,
                  lineHeight: element.lineHeight,
                  padding: `${element.paddingY}px ${element.paddingX}px`,
                }}
              >
                {element.text ||
                  (element.kind === "button" ? "Button" : "Text")}
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ReviewConceptsEditor({
  concepts,
  onChange,
}: {
  concepts: ReviewConcept[];
  onChange: (concepts: ReviewConcept[]) => void;
}) {
  const update = (id: string, next: ReviewConcept) =>
    onChange(concepts.map((concept) => (concept.id === id ? next : concept)));

  return (
    <section className="review-concepts-editor">
      <div className="review-concepts-editor__head">
        <div>
          <h3>Here’s what it could look like</h3>
          <p>
            Build small interface ideas and share the live preview in this
            review.
          </p>
        </div>
        <Button
          disabled={concepts.length >= MAX_CONCEPTS}
          onClick={() => onChange([...concepts, newConcept()])}
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
