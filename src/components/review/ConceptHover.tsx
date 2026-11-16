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
  marks,
}: {
  children: ReactNode;
  element: ReviewConceptElement;
  /**
   * In a sequence: the element's id, and whether it is the step's click
   * target or animates in (conceptSequence.tsx). The same no-space wrapper
   * carries them, which the layout rules already look through.
   */
  marks?: { enter?: string; id: string; trigger?: boolean } | null;
}) {
  const hover = element.kind === "tabs" ? undefined : element.hover;
  if (!(hover || marks)) {
    return children;
  }
  const on = (value: unknown) => (value ? "" : undefined);
  return (
    <span
      className="concept-hover"
      data-concept-id={marks?.id}
      data-enter={marks?.enter}
      data-hover-bg={on(hover?.background)}
      data-hover-icon={on(hover?.iconColor)}
      data-hover-ink={on(hover?.color)}
      data-hover-line={on(hover?.borderColor)}
      data-hover-shadow={on(hover?.shadow)}
      data-trigger={marks?.trigger ? "" : undefined}
      style={
        hover
          ? ({
              "--hover-bg": hover.background,
              "--hover-icon": hover.iconColor,
              "--hover-ink": hover.color,
              "--hover-line": hover.borderColor,
              "--hover-shadow": hover.shadow
                ? shadowCss(hover.shadow)
                : undefined,
            } as CSSProperties)
          : undefined
      }
    >
      {children}
    </span>
  );
}
