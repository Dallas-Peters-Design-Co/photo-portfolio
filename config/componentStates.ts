import type { BrandKitDoc } from "./brandKit.js";
import { createConceptElement } from "./conceptDefaults.js";
import type { ConceptSlot } from "./conceptSlots.js";
import type { ReviewConceptElement } from "./reviewConcept.js";

export const stateLabel = (child: ReviewConceptElement, index: number) =>
  child.stateName?.trim() || `State ${index + 1}`;

/** Older card rows marked every child as a state without naming variants. */
export const usesNamedStates = (group: ConceptSlot) =>
  Boolean(
    group.stateful &&
      !group.disclosureLabel &&
      group.elements.some((child) => child.stateName?.trim())
  );

export const groupDisclosure = (group: ConceptSlot) =>
  group.disclosureLabel ||
  (group.stateful && !usesNamedStates(group) ? "Cards" : undefined);

export function createStatefulComponent(
  doc?: BrandKitDoc | null
): ReviewConceptElement {
  const component = createConceptElement("group", doc);
  return {
    ...component,
    group: {
      ...component.group,
      disclosureLabel: "Cards",
      elements: [],
      stateful: true,
    },
    text: "New component",
  };
}
