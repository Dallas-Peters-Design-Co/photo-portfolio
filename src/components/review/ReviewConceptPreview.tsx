import type { CSSProperties, RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { everyElement } from "../../../config/conceptSlots.js";
import { stepsOf } from "../../../config/conceptSteps.js";
import {
  ALIGN_ITEMS,
  type ReviewConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import type { FontId } from "../../../config/theme.js";
import { loadFont } from "../../theme/fonts";
import { loadFontRef } from "../../theme/remoteFonts";
import { PANEL_HIDDEN } from "./ConceptPanelPreview";
import { ReviewConceptElementView } from "./ReviewConceptElementView";
import "./ReviewConceptPreview.css";

/** The concept's frame: its layout, colours and face. */
export const conceptFrameStyle = (concept: ReviewConcept): CSSProperties =>
  ({
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
  }) as CSSProperties;

/**
 * Which of the step's elements a click landed in: the frame's direct child
 * that holds it, by position. The elements are the frame's children with
 * nothing between them, which the layout rules rely on, so position is
 * identity.
 */
export const clickedIndex = (
  frame: Element,
  target: EventTarget | null
): number => {
  let node = target instanceof Element ? target : null;
  while (node && node.parentElement !== frame) {
    node = node.parentElement;
  }
  return node ? [...frame.children].indexOf(node) : -1;
};

/** Marks the step's trigger on the drawn element, to be drawn as clickable. */
export const useTriggerMark = (
  frame: RefObject<Element | null>,
  elements: ReviewConceptElement[],
  trigger?: string
) => {
  useLayoutEffect(() => {
    const box = frame.current;
    if (!box) {
      return;
    }
    const at = elements.findIndex((e) => e.id === trigger);
    [...box.children].forEach((child, i) => {
      child.toggleAttribute("data-trigger", i === at);
    });
  });
};

/** One step's elements, drawn as the frame's children. */
export function StepElements({
  elements,
}: {
  elements: ReviewConceptElement[];
}) {
  return (
    <>
      {elements.map((element) => (
        <ReviewConceptElementView element={element} key={element.id} />
      ))}
    </>
  );
}

/** Loads every face the concept and its elements name. */
function useConceptFonts(concept: ReviewConcept) {
  useEffect(() => {
    if (concept.fontRef) {
      loadFontRef(concept.fontRef);
    }
    if (concept.fontId) {
      void loadFont(concept.fontId as FontId);
    }
    for (const element of everyElement(
      stepsOf(concept).flatMap((s) => s.elements)
    )) {
      if (element.fontRef) {
        loadFontRef(element.fontRef);
      }
      if (element.fontId) {
        void loadFont(element.fontId as FontId);
      }
    }
  }, [concept]);
}

/** The step count, caption and Back / Next / Start over above a sequence. */
function SequenceBar({
  caption,
  count,
  index,
  setAt,
  trigger,
}: {
  caption?: string;
  count: number;
  index: number;
  setAt: (at: number) => void;
  trigger?: string;
}) {
  const last = index === count - 1;
  return (
    <div className="concept-sequence__bar">
      <span className="concept-sequence__count">
        Step {index + 1} of {count}
      </span>
      <span aria-live="polite" className="concept-sequence__caption">
        {caption || (trigger && !last ? "Click the highlighted part" : "")}
      </span>
      <span className="concept-sequence__controls">
        <button
          disabled={index === 0}
          onClick={() => setAt(index - 1)}
          type="button"
        >
          Back
        </button>
        {last ? (
          <button onClick={() => setAt(0)} type="button">
            Start over
          </button>
        ) : (
          <button onClick={() => setAt(index + 1)} type="button">
            Next
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * A concept on the review page. A single screen is a picture; a sequence
 * (conceptSteps.ts) plays: the viewer clicks the step's trigger in the
 * mock-up itself to see what happens next, with Back, Next and Start over
 * beside it for anyone not using a pointer.
 */
export function ReviewConceptPreview({ concept }: { concept: ReviewConcept }) {
  const steps = stepsOf(concept);
  const [at, setAt] = useState(0);
  const index = Math.min(at, steps.length - 1);
  const step = steps[index];
  const sequence = steps.length > 1;
  const last = index === steps.length - 1;

  useConceptFonts(concept);

  // A native listener rather than onClick: the frame is a picture of an
  // interface, not a control. Back and Next above are the keyboard route.
  const canvasRef = useRef<HTMLFieldSetElement>(null);
  const trigger = last ? undefined : step?.trigger;
  useTriggerMark(canvasRef, step?.elements ?? [], trigger);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas && sequence && trigger)) {
      return;
    }
    const moveOnFrom = (target: EventTarget | null) => {
      const hit = step?.elements[clickedIndex(canvas, target)];
      if (hit?.id === trigger) {
        setAt(index + 1);
        return true;
      }
      return false;
    };
    const advance = (event: MouseEvent) => {
      // A panel's hide slot slides the panel away first; it moves the
      // sequence on once it has gone (PANEL_HIDDEN, below).
      if (
        event.target instanceof Element &&
        event.target.closest("[data-concept-hide]")
      ) {
        return;
      }
      // A panel with a hide button moves on when hidden, not when clicked.
      const hit = step?.elements[clickedIndex(canvas, event.target)];
      if (hit?.kind === "panel" && hit.slots?.hide?.elements.length) {
        return;
      }
      if (moveOnFrom(event.target)) {
        event.preventDefault();
      }
    };
    const hidden = (event: Event) => {
      moveOnFrom(event.target);
    };
    canvas.addEventListener("click", advance);
    canvas.addEventListener(PANEL_HIDDEN, hidden);
    return () => {
      canvas.removeEventListener("click", advance);
      canvas.removeEventListener(PANEL_HIDDEN, hidden);
    };
  }, [index, sequence, step, trigger]);

  return (
    <div className="review-page__concept">
      <h4 className="review-page__concept-title">
        What it could look like
        {concept.title ? <span>{concept.title}</span> : null}
      </h4>
      {sequence ? (
        <SequenceBar
          caption={step?.caption}
          count={steps.length}
          index={index}
          setAt={setAt}
          trigger={step?.trigger}
        />
      ) : null}
      {sequence ? (
        // A fieldset brings its own border, margin and min-content width;
        // reset them so the frame draws as a div would.
        <fieldset
          aria-label={`${concept.title || "Interface concept"} step ${index + 1} of ${steps.length}`}
          className="review-page__concept-preview concept-canvas"
          data-direction={concept.direction}
          data-scroll={concept.scroll || undefined}
          data-sequence
          ref={canvasRef}
          style={{
            border: 0,
            margin: 0,
            ...conceptFrameStyle(concept),
            minInlineSize: 0,
          }}
        >
          <StepElements elements={step?.elements ?? []} />
        </fieldset>
      ) : (
        <div
          aria-label={`${concept.title || "Interface concept"} preview`}
          className="review-page__concept-preview concept-canvas"
          data-direction={concept.direction}
          data-scroll={concept.scroll || undefined}
          role="img"
          style={conceptFrameStyle(concept)}
        >
          <StepElements elements={step?.elements ?? []} />
        </div>
      )}
    </div>
  );
}
