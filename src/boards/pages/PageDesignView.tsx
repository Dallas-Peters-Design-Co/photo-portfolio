import {
  type CSSProperties,
  memo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { hasSlots } from "../../../config/conceptSlots.js";
import { stepsOf } from "../../../config/conceptSteps.js";
import {
  boxOf,
  type PageDesign,
  pageElementBox,
} from "../../../config/pageDesign.js";
import { paletteProperties } from "../../../config/paletteBinding.js";
import { useSequencePlayer } from "../../components/review/conceptSequence";
import { StepElements } from "../../components/review/ReviewConceptPreview";
import { useConceptFont } from "../../components/review/useConceptFont";
import { useActiveBrand } from "../brand/ActiveBrand";
import { PageSelect } from "./PageFields";
import { pageGrid } from "./pageGrid";
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
  const brand = useActiveBrand();
  const palette = brand?.kits.find((k) => k.id === page.kitId)?.resolvedDoc
    .palette;
  const [at, setAt] = useState(0);
  const [scale, setScale] = useState(1);
  const holder = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const steps = stepsOf(page.concept);
  const index = Math.min(stepIndex ?? at, steps.length - 1);
  const step = steps[index];
  const grid = pageGrid(
    step?.elements.map((el, i) => pageElementBox(page, el, i)) ?? []
  );
  const playing = stepIndex === undefined;
  const last = index === steps.length - 1;
  useConceptFont(
    page.concept.fontFamily,
    page.concept.fontRef,
    page.concept.fontId
  );
  useSequencePlayer(sheet, step, playing && steps.length > 1, () =>
    setAt(last ? 0 : index + 1)
  );
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
    <div
      className="page-design"
      ref={holder}
      style={paletteProperties(palette) as CSSProperties}
    >
      {playing && steps.length > 1 ? (
        <nav aria-label="Prototype steps" className="page-design__navigation">
          <button
            disabled={index === 0}
            onClick={() => setAt(index - 1)}
            type="button"
          >
            Back
          </button>
          <PageSelect
            label="Prototype state"
            onChange={(id) =>
              setAt(steps.findIndex((state) => state.id === id))
            }
            options={steps.map((state, i) => ({
              label: state.caption || `State ${i + 1}`,
              value: state.id,
            }))}
            value={step?.id ?? ""}
          />
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
            gridTemplateRows: grid.rows,
            height: page.height,
            transform: `scale(${scale})`,
            width: page.width,
          }}
        >
          {step?.elements.map((element, i) => (
            <div
              className="page-design__component"
              data-group={element.kind === "group" || undefined}
              data-layout-container={
                element.kind === "group" || hasSlots(element.kind) || undefined
              }
              key={element.id}
              style={grid.style(pageElementBox(page, element, i))}
            >
              <StepElements
                elements={[
                  element.kind === "canvas" || element.kind === "shader"
                    ? { ...element, canvasSize: boxOf(page, element.id, i) }
                    : element,
                ]}
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
