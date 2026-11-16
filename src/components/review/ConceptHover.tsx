import type { CSSProperties, ReactNode } from "react";
import { shadowCss } from "../../../config/conceptShadow.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import "./ConceptHover.css";

/**
 * An element's hover look, around whatever draws it: a wrapper that takes
 * no space (display: contents) and carries the hover colours as custom
 * properties, with a data attribute for each one set, so the stylesheet
 * changes only what was asked for. Tabs handle their own (per tab).
 */
export function ConceptHover({
  children,
  element,
}: {
  children: ReactNode;
  element: ReviewConceptElement;
}) {
  const { hover } = element;
  if (!hover || element.kind === "tabs") {
    return children;
  }
  const on = (value: unknown) => (value ? "" : undefined);
  return (
    <span
      className="concept-hover"
      data-hover-bg={on(hover.background)}
      data-hover-ink={on(hover.color)}
      data-hover-line={on(hover.borderColor)}
      data-hover-shadow={on(hover.shadow)}
      style={
        {
          "--hover-bg": hover.background,
          "--hover-ink": hover.color,
          "--hover-line": hover.borderColor,
          "--hover-shadow": hover.shadow ? shadowCss(hover.shadow) : undefined,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}
