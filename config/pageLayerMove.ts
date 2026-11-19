import { fitsAtDepth, ungroup } from "./conceptGroups.js";
import {
  type ConceptSlotName,
  everyElement,
  hasSlots,
  LAYOUT_SLOTS,
  MAX_SLOT_DEPTH,
  MAX_SLOT_ELEMENTS,
  SLOT_NAMES,
} from "./conceptSlots.js";
import type { PageBox } from "./pageDesign.js";
import {
  type ReviewConceptElement as Layer,
  MAX_CONCEPT_ELEMENTS,
} from "./reviewConcept.js";

export type DropPosition = "before" | "inside" | "after" | ConceptSlotName;

export function layerSlots(kind: Layer["kind"]): readonly ConceptSlotName[] {
  if (kind === "panel") {
    return SLOT_NAMES;
  }
  if (kind === "accordion") {
    return ["header", "body"];
  }
  return hasSlots(kind) ? LAYOUT_SLOTS : [];
}
const isSlot = (position: DropPosition): position is ConceptSlotName =>
  SLOT_NAMES.some((name) => name === position);

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
  const slot = isSlot(position) ? position : undefined;
  const inside = position === "inside" || Boolean(slot);
  if (
    slot &&
    (!layerSlots(to.layer.kind).includes(slot) || to.depth >= MAX_SLOT_DEPTH)
  ) {
    return null;
  }
  if (position === "inside" && to.layer.kind !== "group") {
    return null;
  }
  const container = slot ? to.layer.slots?.[slot] : to.layer.group;
  const destination = inside ? (container?.elements ?? []) : to.items;
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
  return { destination, inside, slot, source };
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
  const { source, destination, inside, slot } = targetLocation;
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
        if (el.group || (position === "inside" && el.id === target)) {
          next.group = {
            ...el.group,
            elements: rewrite(el.group?.elements ?? destination),
          };
        }
        if (el.slots) {
          next.slots = Object.fromEntries(
            Object.entries(el.slots).map(([name, value]) => [
              name,
              { ...value, elements: rewrite(value.elements) },
            ])
          );
        }
        if (slot && el.id === target && !el.slots?.[slot]) {
          next.slots = { ...next.slots, [slot]: { elements: [moving] } };
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

export function ungroupPageLayer(roots: Layer[], id: string) {
  const found = locate(roots, id);
  if (found?.layer.kind !== "group") {
    return roots;
  }
  if (
    found.items.length - 1 + (found.layer.group?.elements.length ?? 0) >
    (found.depth === 0 ? MAX_CONCEPT_ELEMENTS : MAX_SLOT_ELEMENTS)
  ) {
    return roots;
  }
  function visit(items: Layer[]): Layer[] {
    if (items === found?.items) {
      return ungroup(
        items,
        items.findIndex((el) => el.id === id)
      );
    }
    return items.map((el) => ({
      ...el,
      ...(el.group
        ? { group: { ...el.group, elements: visit(el.group.elements) } }
        : {}),
      ...(el.slots
        ? {
            slots: Object.fromEntries(
              Object.entries(el.slots).map(([name, value]) => [
                name,
                { ...value, elements: visit(value.elements) },
              ])
            ),
          }
        : {}),
    }));
  }
  return visit(roots);
}
