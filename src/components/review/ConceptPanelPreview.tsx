import { Collapsible } from "@base-ui/react/collapsible";
import { type CSSProperties, type ReactNode, useCallback, useRef } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { ConceptSlotsView } from "./ConceptSlotsView";
import { PANEL_HIDDEN, useSequenceMarks } from "./conceptSequence";

export function ConceptPanelPreview({
  draw,
  element,
  style,
}: {
  draw: (element: ReviewConceptElement) => ReactNode;
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const root = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const hide = element.slots?.hide?.elements ?? [];
  const { editing } = useSequenceMarks();
  // Base UI removes the panel after its closing transition, including when
  // reduced motion skips that transition. Advance a sequence at that point.
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node && closing.current) {
      closing.current = false;
      root.current?.dispatchEvent(
        new CustomEvent(PANEL_HIDDEN, { bubbles: true })
      );
    }
  }, []);
  return (
    <Collapsible.Root
      aria-label={element.text || "Panel"}
      className="concept-panel"
      data-slide={element.slideFrom}
      defaultOpen={!element.panelCollapsed}
      key={String(Boolean(element.panelCollapsed))}
      onOpenChange={(open) => {
        closing.current = !open;
      }}
      ref={root}
    >
      <Collapsible.Panel className="concept-panel__inner" ref={panelRef}>
        <div className="concept-panel__surface" style={style}>
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
        </div>
      </Collapsible.Panel>
      {hide.length || element.panelCollapsed ? (
        <div className="concept-panel__hide" data-concept-hide>
          {editing && hide.length ? (
            hide.map(draw)
          ) : (
            <>
              <Collapsible.Trigger
                aria-label={`Toggle ${element.text || "panel"}`}
                className="concept-panel__trigger"
              />
              <div aria-hidden="true" inert>
                {hide.length ? hide.map(draw) : "×"}
              </div>
            </>
          )}
        </div>
      ) : null}
    </Collapsible.Root>
  );
}
