import type { CSSProperties } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import "./ConceptTabsPreview.css";

/**
 * A row of tabs, the one named by the element's text active. Its look comes
 * through custom properties, each falling back to the old look in the CSS.
 */
export function ConceptTabsPreview({
  element,
  style,
  text,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
  text: string;
}) {
  const look = element.tabLook;
  const vars = {
    ...style,
    "--tab-active": look?.activeColor,
    "--tab-height": look?.height ? `${look.height}px` : undefined,
    "--tab-inactive": look?.inactiveColor,
    "--tab-indicator": look?.indicatorColor,
    "--tab-indicator-size": look?.indicatorSize
      ? `${look.indicatorSize}px`
      : undefined,
    "--tab-padding-x": `${element.paddingX}px`,
    // Side padding belongs to each tab (so the indicator spans it), not the
    // row; the row keeps the top and bottom.
    padding: `${element.paddingY}px 0`,
  } as CSSProperties;
  return (
    <nav aria-label="Preview tabs" className="concept-tabs" style={vars}>
      {(element.options ?? [text]).map((option) => (
        <span
          aria-current={option === text ? "page" : undefined}
          className="concept-tabs__tab"
          key={option}
        >
          {option}
        </span>
      ))}
    </nav>
  );
}
