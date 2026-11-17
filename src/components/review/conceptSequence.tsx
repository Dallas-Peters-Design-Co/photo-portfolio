import { createContext, type RefObject, useContext, useEffect } from "react";
import type { ConceptStep, StepEnter } from "../../../config/conceptSteps.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";

/**
 * What the step being shown asks of its elements: which one to click for the
 * next step, and which one animates in. Read wherever an element is drawn
 * (ReviewConceptElementView), so a button inside a panel's slot or a group
 * can be the target as easily as one at the top.
 */
/** Sent up from a panel once it has slid away: a sequence may move on. */
export const PANEL_HIDDEN = "concept-panel-hidden";

export interface SequenceMarks {
  /**
   * The editor's Edit mode: every element is marked with its id, so a click
   * on it in the preview selects it; panels don't hide on their ✕.
   */
  editing?: boolean;
  enter?: StepEnter;
  /** The element selected in the editor, outlined in the preview. */
  selected?: string | null;
  trigger?: string;
}

const SequenceContext = createContext<SequenceMarks>({});

export const SequenceMarksProvider = SequenceContext.Provider;

export const useSequenceMarks = () => useContext(SequenceContext);

/** The marks an element is drawn with: its id, and what it does here. */
export const marksFor = (
  element: ReviewConceptElement,
  marks: SequenceMarks
): {
  enter?: string;
  id: string;
  selected?: boolean;
  trigger?: boolean;
} | null => {
  const trigger = marks.trigger === element.id;
  const enter =
    marks.enter?.element === element.id ? marks.enter.animation : undefined;
  if (marks.editing) {
    return {
      id: element.id,
      ...(enter ? { enter } : {}),
      ...(marks.selected === element.id ? { selected: true } : {}),
      ...(trigger ? { trigger } : {}),
    };
  }
  return trigger || enter
    ? {
        id: element.id,
        ...(enter ? { enter } : {}),
        ...(trigger ? { trigger } : {}),
      }
    : null;
};

/** What a click in a mock-up can land on and mean "press this". */
const CONTROL =
  "button, a, input, select, textarea, [role=button], [role=tab], [data-concept-id]";

export interface PlayOptions {
  /**
   * The review page: any control in the mock-up moves on, not only the
   * step's trigger, and the last step's controls start it again. A reader
   * presses what they see, and should never need Next to get anywhere.
   */
  anyControl?: boolean;
  /** Back to the first step; with `anyControl`, from the last step. */
  onRestart?: () => void;
}

/** The concept element a click landed in, by id. */
const hitOf = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest("[data-concept-id]")?.getAttribute("data-concept-id")
    : null;

/**
 * What a click on `target` asks for. On a live step: the next step, from its
 * trigger, or (with `anyControl`) from any control. On the last step, with
 * `anyControl`: a restart from any control.
 */
const clickMeans = (
  target: Element,
  trigger: string | undefined,
  live: boolean,
  anyControl: boolean
): "next" | "restart" | null => {
  // A panel that hides first moves on once it has gone (PANEL_HIDDEN).
  if (target.closest("[data-concept-hide]")) {
    return null;
  }
  if (live && trigger && hitOf(target) === trigger) {
    const panel = target.closest(`[data-concept-id="${trigger}"]`);
    return panel?.querySelector("[data-concept-hide]") ? null : "next";
  }
  if (!(anyControl && target.closest(CONTROL))) {
    return null;
  }
  return live ? "next" : "restart";
};

/**
 * Plays a sequence in a frame: a click on the step's trigger, wherever it is
 * drawn, moves on. A panel with a hide button moves on once it has slid away
 * (PANEL_HIDDEN), not when clicked elsewhere. With `anyControl`, every
 * control in the frame plays it (PlayOptions).
 */
export const useSequencePlayer = (
  frame: RefObject<Element | null>,
  step: ConceptStep | undefined,
  /** False on the last step, or for a single screen: nothing to move to. */
  live: boolean,
  onNext: () => void,
  options: PlayOptions = {}
) => {
  const { anyControl = false, onRestart } = options;
  const trigger = live ? step?.trigger : undefined;
  const restart = anyControl && !live ? onRestart : undefined;
  const listening =
    Boolean(trigger) || (anyControl && live) || Boolean(restart);
  useEffect(() => {
    const box = frame.current;
    if (!(box && listening)) {
      return;
    }
    const onClick = (event: Event) => {
      const { target } = event;
      if (!(target instanceof Element)) {
        return;
      }
      const means = clickMeans(target, trigger, live, anyControl);
      const act = means ? { next: onNext, restart }[means] : undefined;
      if (act) {
        event.preventDefault();
        act();
      }
    };
    const onHidden = (event: Event) => {
      if (trigger && hitOf(event.target) === trigger) {
        onNext();
      }
    };
    box.addEventListener("click", onClick);
    box.addEventListener(PANEL_HIDDEN, onHidden);
    return () => {
      box.removeEventListener("click", onClick);
      box.removeEventListener(PANEL_HIDDEN, onHidden);
    };
  }, [frame, trigger, live, listening, onNext, anyControl, restart]);
};
