import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import {
  ConceptField,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";

export const WEIGHTS = optionsOf([
  ["400", "Regular"],
  ["500", "Medium"],
  ["600", "Semibold"],
  ["700", "Bold"],
]);

type Weight = ReviewConceptElement["fontWeight"];

/**
 * A card's own type settings beside the shared ones: its body's size, and
 * its title's weight. Without a title weight the title is drawn bolder
 * than the body, as cards always were, so the field shows Bold.
 */
export function CardTypeFields({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  return (
    <>
      <NumberField
        label="Body size"
        max={72}
        onChange={(bodySize) => onChange({ bodySize })}
        value={element.bodySize ?? element.fontSize}
      />
      <ConceptField label="Title weight">
        <ConceptSelect
          label="Title weight"
          onChange={(weight) =>
            onChange({ titleWeight: Number(weight) as Weight })
          }
          options={WEIGHTS}
          value={String(element.titleWeight ?? 700)}
        />
      </ConceptField>
    </>
  );
}
