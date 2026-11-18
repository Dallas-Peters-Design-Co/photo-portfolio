import type { CSSProperties, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
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
import {
  type SequenceMarks,
  SequenceMarksProvider,
  useSequencePlayer,
} from "./conceptSequence";
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
 * One step's elements, drawn as the frame's children, with the step's click
 * target and entrance marked wherever those elements sit (conceptSequence).
 */
export function StepElements({
  elements,
  marks = {},
}: {
  elements: ReviewConceptElement[];
  marks?: SequenceMarks;
}) {
  return (
    <SequenceMarksProvider value={marks}>
      {elements.map((element) => (
        <ReviewConceptElementView element={element} key={element.id} />
      ))}
    </SequenceMarksProvider>
  );
}

/**
 * Whether the frame has been on screen: from then on its entrances play.
 * True at once where nothing can tell (no IntersectionObserver).
 */
const useSeen = (frame: RefObject<Element | null>): boolean => {
  const [seen, setSeen] = useState(
    () => typeof IntersectionObserver === "undefined"
  );
  useEffect(() => {
    const box = frame.current;
    if (seen || !box) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [frame, seen]);
  return seen;
};

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

  // The frame plays like the interface it pictures: any control in it moves
  // on, the last step's start it again (conceptSequence.tsx). Back and Next
  // above are for the keyboard.
  const canvasRef = useRef<HTMLFieldSetElement>(null);
  const seen = useSeen(canvasRef);
  const trigger = last ? undefined : step?.trigger;
  useSequencePlayer(
    canvasRef,
    step,
    sequence && !last,
    () => setAt(index + 1),
    {
      anyControl: sequence,
      onRestart: () => setAt(0),
    }
  );

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
          // Its entrances wait until it's on screen: played at page load,
          // they'd be over before anyone scrolled down to see them.
          data-waiting={seen ? undefined : ""}
          ref={canvasRef}
          style={{
            border: 0,
            margin: 0,
            ...conceptFrameStyle(concept),
            minInlineSize: 0,
          }}
        >
          <StepElements
            elements={step?.elements ?? []}
            marks={{ enter: step?.enter, trigger }}
          />
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
