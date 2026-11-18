import type { BrandKitDoc } from "./brandKit.js";
import { createConceptElement } from "./conceptDefaults.js";
import {
  MAX_GROUP_DEPTH,
  MAX_SLOT_DEPTH,
  MAX_SLOT_ELEMENTS,
} from "./conceptSlots.js";
import type { ReviewConceptElement } from "./reviewConcept.js";

/** This element in a new group, in its place: the group to add more to. */
export const wrapInGroup = (
  elements: ReviewConceptElement[],
  index: number,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement[] => {
  const element = elements[index];
  if (!element) {
    return elements;
  }
  const group = createConceptElement("group", brandDoc);
  return elements.map((e, i) =>
    i === index
      ? {
          ...group,
          group: {
            ...(group.group ?? { elements: [] }),
            elements: [element],
          },
        }
      : e
  );
};

/** A group's elements back in the list where the group was. */
export const ungroup = (
  elements: ReviewConceptElement[],
  index: number
): ReviewConceptElement[] =>
  elements.flatMap((e, i) =>
    i === index && e.kind === "group" ? (e.group?.elements ?? []) : [e]
  );

/** The closest group earlier in this same list. */
export const groupAbove = (
  elements: ReviewConceptElement[],
  index: number
): number => {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (elements[i]?.kind === "group") {
      return i;
    }
  }
  return -1;
};

/** Moving a holder deeper must not make its contents disappear on save. */
export const fitsAtDepth = (
  element: ReviewConceptElement,
  depth: number
): boolean => {
  if (element.group && depth >= MAX_GROUP_DEPTH) {
    return false;
  }
  if (element.slots && depth >= MAX_SLOT_DEPTH) {
    return false;
  }
  const children = [
    ...(element.group?.elements ?? []),
    ...Object.values(element.slots ?? {}).flatMap(
      (slot) => slot?.elements ?? []
    ),
  ];
  return children.every((child) => fitsAtDepth(child, depth + 1));
};

/** This element moved to the end of the nearest group above it. */
export const moveIntoGroupAbove = (
  elements: ReviewConceptElement[],
  index: number
): ReviewConceptElement[] => {
  const groupIndex = groupAbove(elements, index);
  const above = elements[groupIndex];
  const element = elements[index];
  if (
    !(above?.kind === "group" && element) ||
    (above.group?.elements.length ?? 0) >= MAX_SLOT_ELEMENTS
  ) {
    return elements;
  }
  return elements.flatMap((e, i) => {
    if (i === index) {
      return [];
    }
    if (i === groupIndex) {
      return [
        {
          ...e,
          group: {
            ...(e.group ?? { elements: [] }),
            elements: [...(e.group?.elements ?? []), element],
          },
        },
      ];
    }
    return [e];
  });
};
