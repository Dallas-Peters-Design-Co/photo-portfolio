import { createContext, type RefObject, useContext, useEffect } from "react";
import type { ConceptStep, StepEnter } from "../../../config/conceptSteps.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { PANEL_HIDDEN } from "./ConceptPanelPreview";

/**
 * What the step being shown asks of its elements: which one to click for the
 * next step, and which one animates in. Read wherever an element is drawn
 * (ReviewConceptElementView), so a button inside a panel's slot or a group
 * can be the target as easily as one at the top.
 */
export interface SequenceMarks {
  enter?: StepEnter;
  trigger?: string;
}

const SequenceContext = createContext<SequenceMarks>({});

export const SequenceMarksProvider = SequenceContext.Provider;

export const useSequenceMarks = () => useContext(SequenceContext);

/** The marks an element is drawn with: its id, and what it does here. */
export const marksFor = (
  element: ReviewConceptElement,
  marks: SequenceMarks
): { enter?: string; id: string; trigger?: boolean } | null => {
  const trigger = marks.trigger === element.id;
  const enter =
    marks.enter?.element === element.id ? marks.enter.animation : undefined;
  return trigger || enter
    ? {
        id: element.id,
        ...(enter ? { enter } : {}),
        ...(trigger ? { trigger } : {}),
      }
    : null;
};

/**
 * Plays a sequence in a frame: a click on the step's trigger, wherever it is
 * drawn, moves on. A panel with a hide button moves on once it has slid away
 * (PANEL_HIDDEN), not when clicked elsewhere.
 */
export const useSequencePlayer = (
  frame: RefObject<Element | null>,
  step: ConceptStep | undefined,
  /** False on the last step, or for a single screen: nothing to move to. */
  live: boolean,
  onNext: () => void
) => {
  const trigger = live ? step?.trigger : undefined;
  useEffect(() => {
    const box = frame.current;
    if (!(box && trigger)) {
      return;
    }
    const hitOf = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest("[data-concept-id]")?.getAttribute("data-concept-id")
        : null;
    const onClick = (event: Event) => {
      const { target } = event;
      if (!(target instanceof Element) || hitOf(target) !== trigger) {
        return;
      }
      // A panel that hides first: wait for it to have gone.
      const panel = target.closest(`[data-concept-id="${trigger}"]`);
      if (panel?.querySelector("[data-concept-hide]")) {
        return;
      }
      event.preventDefault();
      onNext();
    };
    const onHidden = (event: Event) => {
      if (hitOf(event.target) === trigger) {
        onNext();
      }
    };
    box.addEventListener("click", onClick);
    box.addEventListener(PANEL_HIDDEN, onHidden);
    return () => {
      box.removeEventListener("click", onClick);
      box.removeEventListener(PANEL_HIDDEN, onHidden);
    };
  }, [frame, trigger, onNext]);
};
