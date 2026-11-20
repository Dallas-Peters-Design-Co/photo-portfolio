import { useState } from "react";
import { lineHeightFrom } from "../../../config/conceptValues.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Input } from "../ui/input";
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
  showBodySize = true,
  showTitleWeight = true,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
  showBodySize?: boolean;
  showTitleWeight?: boolean;
}) {
  return (
    <>
      {showBodySize ? (
        <NumberField
          label="Body size"
          max={72}
          onChange={(bodySize) => onChange({ bodySize })}
          value={element.bodySize ?? element.fontSize}
        />
      ) : null}
      {showTitleWeight ? (
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
      ) : null}
    </>
  );
}

/**
 * Line height, as a multiple (1.4) or in pixels (24). Pixels are turned
 * into the multiple when the field is left or Enter is pressed, so typing
 * "24" is not cut to 2.4 on the way.
 */
export function LineHeightField({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const typed = Number(draft);
    if (draft !== null && draft !== "" && Number.isFinite(typed)) {
      onChange({ lineHeight: lineHeightFrom(typed, element.fontSize) });
    }
    setDraft(null);
  };
  return (
    <ConceptField label="Line height">
      <Input
        aria-label="Line height"
        face="numeric"
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
          }
        }}
        size="sm"
        title="A multiple of the type size (1.4), or pixels (24)"
        type="text"
        value={draft ?? String(element.lineHeight)}
      />
    </ConceptField>
  );
}
