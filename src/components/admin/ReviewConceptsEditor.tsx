import { Plus, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { styleElement } from "../../../config/conceptStyle.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import {
  ALIGN_ITEMS,
  ITEM_WIDTH,
  MAX_REVIEW_CONCEPTS,
} from "../../../config/reviewConcept.js";
import { ReviewConceptElementView } from "../review/ReviewConceptElementView";
import { useConceptFont } from "../review/useConceptFont";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ConceptField,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { ConceptElementList } from "./ConceptElementList";
import { ConceptFontField } from "./ConceptFontField";
import { ConceptColorField, createConcept } from "./ReviewConceptBrand";
import "./ReviewConceptsEditor.css";

const DIRECTIONS = optionsOf([
  ["column", "Vertical"],
  ["row", "Horizontal"],
  ["scroll", "Horizontal, scroll"],
]);
const ALIGNS = optionsOf([
  ["start", "Start"],
  ["center", "Center"],
  ["end", "End"],
  ["stretch", "Stretch"],
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
  // Elements as their kit styles draw them: what the preview shows and the
  // fields edit. Saving them so keeps each one's own values current too.
  const styles = brandDoc?.componentStyles ?? [];
  const elements = concept.elements.map((element) =>
    styleElement(element, styles)
  );
  const setElements = (next: ReviewConceptElement[]) =>
    onChange({ ...concept, elements: next });

  // Each element loads its own face where it is drawn.
  useConceptFont(concept.fontFamily, concept.fontRef, concept.fontId);

  const previewStyle = {
    alignItems: ALIGN_ITEMS[concept.align],
    background: concept.background,
    borderRadius: concept.radius,
    color: concept.color,
    display: "flex",
    flexDirection: concept.direction,
    fontFamily: conceptFontStack(
      concept.fontFamily,
      concept.fontRef,
      concept.fontId
    ),
    gap: concept.gap,
    padding: concept.padding,
    ...(concept.itemWidth
      ? { "--concept-item-width": `${concept.itemWidth}px` }
      : {}),
  } as CSSProperties;

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
            className="review-concepts__preview concept-canvas"
            data-direction={concept.direction}
            data-scroll={concept.scroll || undefined}
            style={previewStyle}
          >
            {elements.map((element) => (
              <ReviewConceptElementView element={element} key={element.id} />
            ))}
          </div>
        </div>
        <div className="review-concepts__controls">
          <div className="review-concepts__control-grid">
            <ConceptField label="Auto layout">
              <ConceptSelect
                label="Auto layout"
                onChange={(layout) =>
                  onChange({
                    ...concept,
                    direction: layout === "column" ? "column" : "row",
                    scroll: layout === "scroll" || undefined,
                  })
                }
                options={DIRECTIONS}
                value={concept.scroll ? "scroll" : concept.direction}
              />
            </ConceptField>
            {concept.scroll ? (
              <NumberField
                label="Card width"
                max={ITEM_WIDTH.max}
                min={ITEM_WIDTH.min}
                onChange={(itemWidth) => onChange({ ...concept, itemWidth })}
                value={concept.itemWidth ?? ITEM_WIDTH.default}
              />
            ) : null}
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

          <ConceptElementList
            brandDoc={brandDoc}
            elements={elements}
            label="Elements"
            onChange={setElements}
          />
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
      {concepts.length >= maxConcepts ? (
        // Said, not left to a grey button.
        <p className="review-concepts-editor__empty" role="status">
          This review holds the most concepts it can ({MAX_REVIEW_CONCEPTS}).
          Remove one here or on another note to add another.
        </p>
      ) : null}
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
