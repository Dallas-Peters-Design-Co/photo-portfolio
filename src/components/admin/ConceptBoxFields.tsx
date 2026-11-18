import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { ConceptGroup, NumberField } from "./ConceptControls";
/** The element's corner radius and its padding. */
export function BoxGroup({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  return (
    <ConceptGroup compact name="Box">
      <NumberField
        label="Radius"
        max={48}
        onChange={(radius) => onChange({ radius })}
        value={element.radius}
      />
      {/* A tab's side padding is in the Tabs group, beside the row's. */}
      {element.kind === "tabs" || element.kind === "group" ? null : (
        <NumberField
          label="Padding X"
          onChange={(paddingX) => onChange({ paddingX })}
          value={element.paddingX}
        />
      )}
      {element.kind !== "group" && (
        <NumberField
          label="Padding Y"
          onChange={(paddingY) => onChange({ paddingY })}
          value={element.paddingY}
        />
      )}
    </ConceptGroup>
  );
}
