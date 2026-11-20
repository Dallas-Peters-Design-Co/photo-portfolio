import { useId } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Checkbox } from "../ui/checkbox";
import { ConceptGroup, NumberField } from "./ConceptControls";
/** The element's corner radius and its padding. */
export function BoxGroup({
  element,
  onChange,
  showFullHeight = true,
  showPaddingX = true,
  showPaddingY = true,
  showRadius = true,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
  showFullHeight?: boolean;
  showPaddingX?: boolean;
  showPaddingY?: boolean;
  showRadius?: boolean;
}) {
  const id = useId();
  if (!(showFullHeight || showPaddingX || showPaddingY || showRadius)) {
    return null;
  }
  return (
    <ConceptGroup compact name="Box">
      {showRadius ? (
        <NumberField
          label="Radius"
          max={48}
          onChange={(radius) => onChange({ radius })}
          value={element.radius}
        />
      ) : null}
      {/* A tab's side padding is in the Tabs group, beside the row's. */}
      {showPaddingX && element.kind !== "tabs" && element.kind !== "group" && (
        <NumberField
          label="Padding X"
          onChange={(paddingX) => onChange({ paddingX })}
          value={element.paddingX}
        />
      )}
      {showPaddingY && element.kind !== "group" && (
        <NumberField
          label="Padding Y"
          onChange={(paddingY) => onChange({ paddingY })}
          value={element.paddingY}
        />
      )}
      {showFullHeight &&
        (element.kind === "card" || element.kind === "panel") && (
          <label className="review-concepts__check" htmlFor={id}>
            <Checkbox
              checked={element.fullHeight ?? false}
              id={id}
              onChange={(event) =>
                onChange({ fullHeight: event.target.checked })
              }
            />
            Full height
          </label>
        )}
    </ConceptGroup>
  );
}
