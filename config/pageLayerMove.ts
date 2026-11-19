import { fitsAtDepth } from "./conceptGroups.js";
import { everyElement, MAX_SLOT_ELEMENTS } from "./conceptSlots.js";
import type { PageBox } from "./pageDesign.js";
import {
  type ReviewConceptElement as Layer,
  MAX_CONCEPT_ELEMENTS,
} from "./reviewConcept.js";

export type DropPosition = "before" | "inside" | "after";

function locate(
  items: Layer[],
  id: string,
  depth = 0
): { items: Layer[]; layer: Layer; depth: number } | undefined {
  for (const layer of items) {
    if (layer.id === id) {
      return { depth, items, layer };
    }
    const lists = [layer.group, ...Object.values(layer.slots ?? {})];
    for (const list of lists) {
      const found = list && locate(list.elements, id, depth + 1);
      if (found) {
        return found;
      }
    }
  }
}

export function layerDestination(
  roots: Layer[],
  id: string,
  target: string,
  position: DropPosition
) {
  const source = locate(roots, id);
  const to = locate(roots, target);
  if (
    !(source && to) ||
    everyElement([source.layer]).some((el) => el.id === target)
  ) {
    return null;
  }
  const inside = position === "inside";
  if (inside && to.layer.kind !== "group") {
    return null;
  }
  const destination = inside ? (to.layer.group?.elements ?? []) : to.items;
  if (
    destination !== source.items &&
    destination.length >=
      (destination === roots ? MAX_CONCEPT_ELEMENTS : MAX_SLOT_ELEMENTS)
  ) {
    return null;
  }
  if (!fitsAtDepth(source.layer, to.depth + Number(inside))) {
    return null;
  }
  return { destination, inside, source, to };
}

export function movePageLayer(
  roots: Layer[],
  id: string,
  target: string,
  position: DropPosition,
  box?: PageBox
): Layer[] {
  const targetLocation = layerDestination(roots, id, target, position);
  if (!targetLocation) {
    return roots;
  }
  const { source, destination, inside } = targetLocation;
  const artwork =
    source.layer.kind === "canvas" || source.layer.kind === "shader";
  const moving =
    artwork && box && source.items === roots && destination !== roots
      ? {
          ...source.layer,
          canvasSize: { height: box.height, width: box.width },
        }
      : source.layer;
  const rewrite = (items: Layer[]): Layer[] => {
    const result = items
      .filter((el) => el.id !== id)
      .map((el) => {
        const next = { ...el };
        if (el.group || (inside && el.id === target)) {
          next.group = {
            ...el.group,
            elements: rewrite(el.group?.elements ?? destination),
          };
        }
        if (el.slots) {
          next.slots = Object.fromEntries(
            Object.entries(el.slots).map(([name, slot]) => [
              name,
              { ...slot, elements: rewrite(slot.elements) },
            ])
          );
        }
        return next;
      });
    if (items === destination) {
      const index = inside
        ? result.length
        : result.findIndex((el) => el.id === target) +
          Number(position === "after");
      result.splice(index, 0, moving);
    }
    return result;
  };
  return rewrite(roots);
}
