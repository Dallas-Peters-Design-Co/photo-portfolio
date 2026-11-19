import type { CSSProperties, ReactNode } from "react";
import { shadowCss } from "../../../config/conceptShadow.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import "./ConceptHover.css";

/**
 * An element's hover and focus looks, around whatever draws it: a wrapper that
 * takes no space and carries the state colours as custom properties. Tabs
 * handle their own state treatment.
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
  marks?: {
    enter?: string;
    id: string;
    selected?: boolean;
    trigger?: boolean;
  } | null;
}) {
  const hover = element.kind === "tabs" ? undefined : element.hover;
  const { focus } = element;
  if (!(hover || focus || marks)) {
    return children;
  }
  const on = (value: unknown) => (value ? "" : undefined);
  return (
    <span
      className="concept-hover"
      data-concept-id={marks?.id}
      data-enter={marks?.enter}
      data-focus-bg={on(focus?.background)}
      data-focus-icon={on(focus?.iconColor)}
      data-focus-ink={on(focus?.color)}
      data-focus-line={on(focus?.borderColor)}
      data-focus-ring={on(focus)}
      data-focus-shadow={on(focus?.shadow)}
      data-hover-bg={on(hover?.background)}
      data-hover-icon={on(hover?.iconColor)}
      data-hover-ink={on(hover?.color)}
      data-hover-line={on(hover?.borderColor)}
      data-hover-shadow={on(hover?.shadow)}
      data-selected={marks?.selected ? "" : undefined}
      data-trigger={marks?.trigger ? "" : undefined}
      style={
        hover || focus
          ? ({
              "--focus-bg": focus?.background,
              "--focus-icon": focus?.iconColor,
              "--focus-ink": focus?.color,
              "--focus-line": focus?.borderColor,
              "--focus-ring-color": focus?.ringColor ?? element.accentColor,
              "--focus-ring-width":
                focus?.ringWidth === undefined
                  ? undefined
                  : `${focus.ringWidth}px`,
              "--focus-shadow": focus?.shadow
                ? shadowCss(focus.shadow)
                : undefined,
              "--hover-bg": hover?.background,
              "--hover-icon": hover?.iconColor,
              "--hover-ink": hover?.color,
              "--hover-line": hover?.borderColor,
              "--hover-shadow": hover?.shadow
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
