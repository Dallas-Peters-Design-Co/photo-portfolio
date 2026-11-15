import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import {
  ALIGN_ITEMS,
  MAX_REVIEW_CONCEPTS,
} from "../../../config/reviewConcept.js";
import { loadFontRef } from "../../theme/remoteFonts";
import { ReviewConceptElementView } from "../review/ReviewConceptElementView";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  ConceptField,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { ConceptFontField, conceptFontCss } from "./ConceptFontField";
import {
  addConceptElement,
  ConceptColorField,
  createConcept,
  duplicateConceptElement,
} from "./ReviewConceptBrand";
import { ReviewConceptElementFields } from "./ReviewConceptElementFields";
import "./ReviewConceptsEditor.css";

const DIRECTIONS = optionsOf([
  ["column", "Vertical"],
  ["row", "Horizontal"],
]);
const ALIGNS = optionsOf([
  ["start", "Start"],
  ["center", "Center"],
  ["end", "End"],
  ["stretch", "Stretch"],
]);
const KINDS = optionsOf([
  ["text", "Text"],
  ["icon", "Icon"],
  ["button", "Button"],
  ["input", "Input"],
  ["textarea", "Text area"],
  ["select", "Select"],
  ["checkbox", "Checkbox"],
  ["card", "Card"],
  ["label", "Label"],
  ["badge", "Badge"],
  ["link", "Link"],
  ["divider", "Divider"],
  ["tabs", "Tabs"],
  ["table", "Table"],
  ["dialog", "Dialog"],
  ["menu", "Dropdown menu"],
  ["toast", "Toast"],
  ["skeleton", "Skeleton loader"],
]);

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
      elements: addConceptElement(concept.elements, kind, brandDoc),
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
        <div className="review-concepts__title">
          <Input
            aria-label="Concept name"
            onChange={(event) =>
              onChange({ ...concept, title: event.target.value })
            }
            placeholder="Name this concept"
            size="sm"
            value={concept.title}
          />
        </div>
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
          <div
            className="review-concepts__preview"
            data-direction={concept.direction}
            style={previewStyle}
          >
            {concept.elements.map((element) => (
              <ReviewConceptElementView element={element} key={element.id} />
            ))}
          </div>
        </div>
        <div className="review-concepts__controls">
          <div className="review-concepts__control-grid">
            <ConceptField label="Auto layout">
              <ConceptSelect
                label="Auto layout"
                onChange={(direction) =>
                  onChange({
                    ...concept,
                    direction: direction === "row" ? "row" : "column",
                  })
                }
                options={DIRECTIONS}
                value={concept.direction}
              />
            </ConceptField>
            <ConceptField label="Align items">
              <ConceptSelect
                label="Align items"
                onChange={(align) =>
                  onChange({
                    ...concept,
                    align: align as ReviewConcept["align"],
                  })
                }
                options={ALIGNS}
                value={concept.align}
              />
            </ConceptField>
            <NumberField
              label="Gap"
              max={64}
              onChange={(gap) => onChange({ ...concept, gap })}
              value={concept.gap}
            />
            <NumberField
              label="Padding"
              max={96}
              onChange={(padding) => onChange({ ...concept, padding })}
              value={concept.padding}
            />
            <NumberField
              label="Corner radius"
              max={64}
              onChange={(radius) => onChange({ ...concept, radius })}
              value={concept.radius}
            />
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
                <ConceptSelect
                  label="Add a component"
                  onChange={(kind) =>
                    addElement(kind as ReviewConceptElementKind)
                  }
                  options={KINDS}
                  placeholder="+ Add component"
                  value=""
                />
              </div>
            </div>
            {concept.elements.map((element) => (
              <ReviewConceptElementFields
                brandDoc={brandDoc}
                element={element}
                key={element.id}
                onChange={(patch) => updateElement(element.id, patch)}
                onDuplicate={() =>
                  onChange({
                    ...concept,
                    elements: duplicateConceptElement(
                      concept.elements,
                      element.id
                    ),
                  })
                }
                onRemove={() =>
                  onChange({
                    ...concept,
                    elements: concept.elements.filter(
                      (item) => item.id !== element.id
                    ),
                  })
                }
              />
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
