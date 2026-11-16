import { X } from "lucide-react";
import type { CSSProperties } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import "./ConceptToastPreview.css";

/**
 * A toast: its message, an optional action ("Undo") in the action colour,
 * and a close button unless it is turned off.
 */
export function ConceptToastPreview({
  element,
  style,
  text,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
  text: string;
}) {
  const action = element.toastAction?.trim();
  return (
    <div
      aria-label="Toast preview"
      className="concept-toast"
      role="status"
      style={style}
    >
      <span className="concept-toast__text">{text}</span>
      {action ? (
        <button
          className="concept-toast__action"
          style={{ color: element.accentColor }}
          type="button"
        >
          {action}
        </button>
      ) : null}
      {element.toastClose === false ? null : (
        <button
          aria-label="Close"
          className="concept-toast__close"
          type="button"
        >
          <X aria-hidden size="1em" />
        </button>
      )}
    </div>
  );
}
