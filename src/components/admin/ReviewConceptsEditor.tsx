import { ClipboardPaste, Copy, Plus, Trash2 } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { createConcept } from "../../../config/conceptDefaults.js";
import { conceptFontStack } from "../../../config/conceptFont.js";
import {
  freshConcept,
  stepsOf,
  withStep,
} from "../../../config/conceptSteps.js";
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
import { useSequencePlayer } from "../review/conceptSequence";
import { StepElements } from "../review/ReviewConceptPreview";
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
import { ConceptStepsBar } from "./ConceptStepsBar";
import { copyConcept, useCopiedConcept } from "./conceptClipboard";
import {
  type ElementFocus,
  ElementFocusProvider,
  NO_FOCUS,
  pathTo,
} from "./elementFocus";
import { ConceptColorField } from "./ReviewConceptBrand";
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
  // A sequence is edited one step at a time (ConceptStepsBar).
  const [stepIndex, setStepIndex] = useState(0);
  const steps = stepsOf(concept);
  const at = Math.min(stepIndex, steps.length - 1);
  const step = steps[at];
  const elements = (step?.elements ?? []).map((element) =>
    styleElement(element, styles)
  );
  const preview = useRef<HTMLDivElement>(null);
  const live = at < steps.length - 1;
  // The preview plays: clicking the step's target opens the next step here,
  // as the viewer's click does on the review page.
  // Edit: a click in the preview picks the element and opens its settings.
  // Play: the preview plays the sequence, as the review page does.
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState<ElementFocus>(NO_FOCUS);
  useSequencePlayer(preview, step, playing && live, () => setStepIndex(at + 1));
  useEffect(() => {
    const box = preview.current;
    if (!box || playing) {
      return;
    }
    const pick = (event: Event) => {
      const id = (event.target as Element | null)
        ?.closest?.("[data-concept-id]")
        ?.getAttribute("data-concept-id");
      if (!id) {
        return;
      }
      event.preventDefault();
      setFocus((was) => ({
        nonce: was.nonce + 1,
        path: new Set(pathTo(step?.elements ?? [], id)),
        target: id,
      }));
    };
    box.addEventListener("click", pick);
    return () => box.removeEventListener("click", pick);
  }, [playing, step]);
  const setElements = (next: ReviewConceptElement[]) => {
    if (step) {
      onChange(withStep(concept, at, { ...step, elements: next }));
    }
  };

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
          aria-label={`Copy ${concept.title || "concept"}`}
          onClick={() => {
            copyConcept(concept);
            toast.success(
              "Concept copied. Paste it into any note, or into a sequence as steps."
            );
          }}
          size="icon-sm"
          title="Copy, to paste into another note or a sequence"
          type="button"
          variant="ghost"
        >
          <Copy size={14} />
        </Button>
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

      <ConceptStepsBar
        concept={concept}
        index={at}
        onChange={onChange}
        onIndex={setStepIndex}
      />

      <div className="review-concepts__workspace">
        <div className="review-concepts__preview-wrap">
          <div className="review-concepts__preview-head">
            <p>Live preview</p>
            <fieldset
              aria-label="Preview mode"
              className="review-concepts__mode"
            >
              <button
                aria-pressed={!playing}
                onClick={() => setPlaying(false)}
                title="Click a part of the preview to edit it"
                type="button"
              >
                Edit
              </button>
              <button
                aria-pressed={playing}
                onClick={() => setPlaying(true)}
                title="Click through the sequence as a viewer would"
                type="button"
              >
                Play
              </button>
            </fieldset>
          </div>
          <div
            className="review-concepts__preview concept-canvas"
            data-direction={concept.direction}
            data-scroll={concept.scroll || undefined}
            ref={preview}
            style={previewStyle}
          >
            <StepElements
              elements={elements}
              marks={{
                editing: !playing,
                enter: step?.enter,
                selected: playing ? null : focus.target,
                trigger: live ? step?.trigger : undefined,
              }}
            />
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

          <ElementFocusProvider value={focus}>
            <ConceptElementList
              brandDoc={brandDoc}
              elements={elements}
              label="Elements"
              onChange={setElements}
            />
          </ElementFocusProvider>
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
  const copied = useCopiedConcept();
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
        {copied ? (
          <Button
            disabled={concepts.length >= maxConcepts}
            onClick={() => onChange([...concepts, freshConcept(copied)])}
            title={`Paste ${copied.title || "the copied concept"}`}
            type="button"
            variant="outline"
          >
            <ClipboardPaste size={14} /> Paste concept
          </Button>
        ) : null}
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
