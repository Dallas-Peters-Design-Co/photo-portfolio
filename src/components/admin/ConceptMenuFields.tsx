import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptMenuLook,
  MENU_LIMITS,
} from "../../../config/conceptMenu.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { ConceptGroup, NumberField } from "./ConceptControls";
import { ConceptColorField } from "./ReviewConceptBrand";

/**
 * A select's or dropdown menu's open list: its fill, text, edge, corners and
 * highlighted row. Each starts as the element's own, so the list matches the
 * control until it is set apart.
 */
export function MenuGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const look = element.menuLook ?? {};
  const set = (patch: ConceptMenuLook) =>
    onChange({ menuLook: { ...look, ...patch } });
  const fill =
    look.background ??
    (element.background === "transparent" ? "#ffffff" : element.background);
  const ink = look.color ?? element.color;
  return (
    <ConceptGroup compact name="Open list">
      <ConceptColorField
        ariaLabel="list fill color"
        brandDoc={brandDoc}
        label="Fill"
        onChange={(background) => set({ background })}
        value={fill}
      />
      <ConceptColorField
        ariaLabel="list text color"
        brandDoc={brandDoc}
        label="Text"
        onChange={(color) => set({ color })}
        value={ink}
      />
      <ConceptColorField
        ariaLabel="list border color"
        brandDoc={brandDoc}
        label="Border"
        onChange={(borderColor) => set({ borderColor })}
        value={look.borderColor ?? element.borderColor ?? ink}
      />
      <NumberField
        label="Radius"
        max={MENU_LIMITS.radius[1]}
        min={MENU_LIMITS.radius[0]}
        onChange={(radius) => set({ radius })}
        value={look.radius ?? element.radius}
      />
      <ConceptColorField
        ariaLabel="highlighted row color"
        brandDoc={brandDoc}
        label="Highlight"
        onChange={(highlight) => set({ highlight })}
        value={look.highlight ?? fill}
      />
      <ConceptColorField
        ariaLabel="highlighted row text color"
        brandDoc={brandDoc}
        label="Highlight text"
        onChange={(highlightColor) => set({ highlightColor })}
        value={look.highlightColor ?? ink}
      />
    </ConceptGroup>
  );
}
