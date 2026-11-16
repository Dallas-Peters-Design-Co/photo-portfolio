import type { BrandKitDoc } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import { newItemId } from "../../../config/proposal.js";
import {
  ELEMENT_STYLE_KEYS,
  type ReviewConcept,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import { ColorWell } from "../../boards/ColorWell";
import { ConceptSelect } from "./ConceptControls";

export const conceptFontSelection = (
  family: string,
  fontRef?: string,
  fontId?: string
): string => {
  if (family === "brand" && fontRef) {
    return `brand|${fontRef}`;
  }
  if (family === "app" && fontId) {
    return `app|${fontId}`;
  }
  return family;
};

export const conceptFontPatch = (
  value: string
): Pick<ReviewConcept, "fontFamily" | "fontRef" | "fontId"> => {
  if (value.startsWith("brand|")) {
    return {
      fontFamily: "brand",
      fontId: undefined,
      fontRef: value.slice("brand|".length),
    };
  }
  if (value.startsWith("app|")) {
    return {
      fontFamily: "app",
      fontId: value.slice("app|".length),
      fontRef: undefined,
    };
  }
  return {
    fontFamily: value as ReviewConcept["fontFamily"],
    fontId: undefined,
    fontRef: undefined,
  };
};

const NONE = "transparent";

/**
 * A colour from the brand palette or the swatch. With `allowNone`, "None"
 * clears it (stored as "transparent"): no fill, no border.
 */
export function ConceptColorField({
  allowNone = false,
  ariaLabel,
  brandDoc,
  label,
  onChange,
  value,
}: {
  allowNone?: boolean;
  ariaLabel: string;
  brandDoc?: BrandKitDoc | null;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const palette = (brandDoc?.palette ?? []).filter(
    (entry, index, all) =>
      all.findIndex((other) => other.value === entry.value) === index
  );
  const options = [
    ...(allowNone ? [{ label: "None", value: NONE }] : []),
    ...palette.map((entry) => ({
      label:
        [entry.role, entry.name].filter(Boolean).join(" · ") || entry.value,
      value: entry.value,
    })),
  ];
  const listed = options.some((option) => option.value === value);
  return (
    <div className="review-concepts__field review-concepts__field--color">
      <span>{label}</span>
      <div className="review-concepts__color-row">
        {options.length > 0 ? (
          <div className="review-concepts__color-pick">
            <ConceptSelect
              label={`${ariaLabel} brand color`}
              onChange={onChange}
              options={options}
              placeholder="Custom color"
              value={listed ? value : ""}
            />
          </div>
        ) : null}
        <ColorWell label={ariaLabel} noVars onChange={onChange} value={value} />
      </div>
    </div>
  );
}

/**
 * A new element takes the look of the last one of its kind, so a second
 * button matches the first without restyling it. Content stays the default.
 */
export const addConceptElement = (
  elements: ReviewConceptElement[],
  kind: ReviewConceptElementKind,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement[] => {
  const fresh = createConceptElement(kind, brandDoc);
  const model = elements.filter((element) => element.kind === kind).at(-1);
  if (!model) {
    return [...elements, fresh];
  }
  const isStyle = (key: string) =>
    (ELEMENT_STYLE_KEYS as readonly string[]).includes(key);
  const content = Object.entries(fresh).filter(([key]) => !isStyle(key));
  const style = Object.entries(model).filter(([key]) => isStyle(key));
  return [
    ...elements,
    Object.fromEntries([...content, ...style]) as ReviewConceptElement,
  ];
};

/** An exact copy, placed right after the original. */
export const duplicateConceptElement = (
  elements: ReviewConceptElement[],
  id: string
): ReviewConceptElement[] =>
  elements.flatMap((element) =>
    element.id === id ? [element, { ...element, id: newItemId() }] : [element]
  );
