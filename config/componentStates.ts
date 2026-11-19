import type { BrandKitDoc } from "./brandKit.js";
import { createConceptElement } from "./conceptDefaults.js";
import { freshIds } from "./conceptSteps.js";
import type { ReviewConceptElement } from "./reviewConcept.js";

export const stateLabel = (child: ReviewConceptElement, index: number) =>
  child.stateName?.trim() || `State ${index + 1}`;

export function createStatefulComponent(
  doc?: BrandKitDoc | null
): ReviewConceptElement {
  const component = createConceptElement("group", doc);
  const state = createConceptElement("text", doc);
  return {
    ...component,
    group: {
      ...component.group,
      elements: [
        { ...state, stateName: "Default", text: "Default" },
        { ...freshIds(state), stateName: "Active", text: "Active" },
      ],
      stateful: true,
    },
    text: "New component",
  };
}
