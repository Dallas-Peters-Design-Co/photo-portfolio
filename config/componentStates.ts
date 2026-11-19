import type { BrandKitDoc } from "./brandKit.js";
import { createConceptElement } from "./conceptDefaults.js";
import type { ConceptSlot } from "./conceptSlots.js";
import type { ReviewConceptElement } from "./reviewConcept.js";

export const stateLabel = (child: ReviewConceptElement, index: number) =>
  child.stateName?.trim() || `State ${index + 1}`;

/** Older card rows marked every child as a state without naming variants. */
export const usesNamedStates = (group: ConceptSlot) =>
  Boolean(
    group.stateful && group.elements.some((child) => child.stateName?.trim())
  );

export const groupDisclosure = (group: ConceptSlot) =>
  group.stateful ? undefined : group.disclosureLabel;

export const stateNames = (group: ConceptSlot) =>
  usesNamedStates(group)
    ? group.elements.map(stateLabel)
    : ["Expanded", "Collapsed"];

export const initialState = (group: ConceptSlot) =>
  Math.min(group.initialState ?? 0, stateNames(group).length - 1);

export function createStatefulComponent(
  doc?: BrandKitDoc | null
): ReviewConceptElement {
  const component = createConceptElement("group", doc);
  return {
    ...component,
    group: {
      ...component.group,
      elements: [],
      stateful: true,
    },
    text: "New component",
  };
}
