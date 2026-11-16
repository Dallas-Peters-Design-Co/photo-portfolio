import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { ConceptSlotsView } from "./ConceptSlotsView";

/** Sent up from a panel once it has slid away: a sequence may move on. */
export const PANEL_HIDDEN = "concept-panel-hidden";

const prefersStill = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A panel: its slots, its title at the start of the header, and its hide
 * slot in the top-right corner. With a side to slide from, it slides in as
 * it appears, and a click in the hide slot slides it back out; then it says
 * so (PANEL_HIDDEN), which a sequence takes as the panel's click.
 *
 * Gone, it leaves a small "Show panel" in its place, to play it again, and
 * keeps its place among the frame's elements, which are known by position.
 */
export function ConceptPanelPreview({
  draw,
  element,
  style,
}: {
  draw: (element: ReviewConceptElement) => ReactNode;
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const [state, setState] = useState<"open" | "closing" | "closed">("open");
  const root = useRef<HTMLElement>(null);
  const hide = element.slots?.hide?.elements ?? [];
  const hideSlot = useRef<HTMLDivElement>(null);

  const finish = () => {
    root.current?.dispatchEvent(
      new CustomEvent(PANEL_HIDDEN, { bubbles: true })
    );
    setState("closed");
  };
  const close = () => {
    if (element.slideFrom && !prefersStill()) {
      setState("closing");
    } else {
      finish();
    }
  };

  // A native listener: the slot holds the control (a button, an ✕), and its
  // own click (or Enter on it) is what hides the panel.
  useEffect(() => {
    const slot = hideSlot.current;
    if (!slot) {
      return;
    }
    const onClick = () => close();
    slot.addEventListener("click", onClick);
    return () => slot.removeEventListener("click", onClick);
  });

  if (state === "closed") {
    return (
      <section className="concept-panel concept-panel--closed" ref={root}>
        <button
          className="concept-panel__show"
          onClick={() => setState("open")}
          type="button"
        >
          Show panel
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label={element.text || "Panel"}
      className="concept-panel"
      data-closing={state === "closing" || undefined}
      data-has-hide={hide.length > 0 || undefined}
      data-slide={element.slideFrom}
      onAnimationEnd={() => {
        if (state === "closing") {
          finish();
        }
      }}
      ref={root}
      style={style}
    >
      <ConceptSlotsView
        dividers={element.dividers}
        draw={draw}
        lead={
          element.text ? (
            <strong className="concept-slot__lead">{element.text}</strong>
          ) : undefined
        }
        slots={element.slots}
      />
      {hide.length > 0 ? (
        <div className="concept-panel__hide" data-concept-hide ref={hideSlot}>
          {hide.map(draw)}
        </div>
      ) : null}
    </section>
  );
}
