import { memo, type ReactNode, useEffect, useRef, useState } from "react";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { hasSlots } from "../../../config/conceptSlots.js";
import { stepsOf } from "../../../config/conceptSteps.js";
import {
  boxOf,
  type PageDesign,
  pageBoxStyle,
} from "../../../config/pageDesign.js";
import { useSequencePlayer } from "../../components/review/conceptSequence";
import { StepElements } from "../../components/review/ReviewConceptPreview";
import { useConceptFont } from "../../components/review/useConceptFont";
import "./PageDesignView.css";

/** The same DOM and geometry in the editor, on the board, and in the review. */
export const PageDesignView = memo(function PageView({
  page,
  stepIndex,
  selectedChild,
  children,
}: {
  children?: ReactNode;
  page: PageDesign;
  /** Controlled while editing; absent when the viewer plays the prototype. */
  stepIndex?: number;
  selectedChild?: string | null;
}) {
  const [at, setAt] = useState(0);
  const [scale, setScale] = useState(1);
  const holder = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const steps = stepsOf(page.concept);
  const index = Math.min(stepIndex ?? at, steps.length - 1);
  const step = steps[index];
  const playing = stepIndex === undefined;
  const last = index === steps.length - 1;
  useConceptFont(
    page.concept.fontFamily,
    page.concept.fontRef,
    page.concept.fontId
  );
  useSequencePlayer(sheet, step, playing && !last, () => setAt(index + 1));
  useEffect(() => {
    const el = holder.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setScale(Math.min(1, el.clientWidth / page.width))
    );
    observer.observe(el);
    setScale(Math.min(1, el.clientWidth / page.width));
    return () => observer.disconnect();
  }, [page.width]);
  const { concept } = page;
  return (
    <div className="page-design" ref={holder}>
      {playing && steps.length > 1 ? (
        <nav aria-label="Prototype steps" className="page-design__navigation">
          <button
            disabled={index === 0}
            onClick={() => setAt(index - 1)}
            type="button"
          >
            Back
          </button>
          <span aria-live="polite">
            {step?.caption || `Step ${index + 1} of ${steps.length}`}
          </span>
          <button onClick={() => setAt(last ? 0 : index + 1)} type="button">
            {last ? "Start over" : "Next"}
          </button>
        </nav>
      ) : null}
      <div
        className="page-design__viewport"
        style={{ height: page.height * scale }}
      >
        <div
          className="page-design__sheet concept-canvas"
          ref={sheet}
          style={{
            background: concept.background,
            color: concept.color,
            fontFamily: conceptFontStack(
              concept.fontFamily,
              concept.fontRef,
              concept.fontId
            ),
            height: page.height,
            transform: `scale(${scale})`,
            width: page.width,
          }}
        >
          {step?.elements.map((element, i) => (
            <div
              className="page-design__component"
              data-layout-container={
                element.kind === "group" || hasSlots(element.kind) || undefined
              }
              key={element.id}
              style={pageBoxStyle(boxOf(page, element.id, i))}
            >
              <StepElements
                elements={[element]}
                marks={{
                  enter: step.enter,
                  selected: selectedChild,
                  trigger: step.trigger,
                }}
              />
            </div>
          ))}
          {children}
        </div>
      </div>
    </div>
  );
});
