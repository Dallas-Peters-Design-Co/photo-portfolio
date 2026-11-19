import { createConceptElement } from "./conceptDefaults.js";
import {
  type ConceptSlot,
  type ConceptSlots,
  hasSlots,
  SLOT_NAMES,
} from "./conceptSlots.js";
import { type ConceptStyleLook, lookOf } from "./conceptStyle.js";
import { tableOf } from "./conceptTable.js";
import {
  ELEMENT_STYLE_KEYS,
  type ReviewConceptElement,
} from "./reviewConcept.js";

// These properties identify the content or control its behavior.
const INSTANCE_KEYS = new Set<string>([
  "avatarUrl",
  "avatarInitials",
  "logoUrl",
  "summaryIconName",
  "summaryIconSvg",
  "iconName",
  "iconSvg",
  "panelCollapsed",
  "accordionExpanded",
]);
const SHARED_KEYS = new Set<string>([
  "background",
  "color",
  "fontFamily",
  "fontId",
  "fontRef",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "paddingX",
  "paddingY",
  "radius",
  "borderColor",
  "borderWidth",
  "shadow",
  "flex",
  "iconColor",
  "iconSize",
  "hover",
]);

function slotLayout(source: ConceptSlot, target?: ConceptSlot): ConceptSlot {
  const { stateful: _stateful, ...layout } = source;
  return {
    ...layout,
    ...(target?.stateful ? { stateful: true } : {}),
    elements: target?.elements ?? [],
  };
}

function transferSlots(
  source: ConceptSlots,
  target: ConceptSlots = {}
): ConceptSlots {
  const slots: ConceptSlots = {};
  for (const name of SLOT_NAMES) {
    const from = source[name];
    if (from || target[name]) {
      slots[name] = slotLayout(from ?? { elements: [] }, target[name]);
    }
  }
  return slots;
}

export function copyComponentLook(
  element: ReviewConceptElement
): ConceptStyleLook {
  const look = lookOf(element);
  for (const key of ELEMENT_STYLE_KEYS) {
    if (INSTANCE_KEYS.has(key)) {
      delete look[key];
    }
  }
  if (element.group) {
    look.groupContents = slotLayout(element.group);
  }
  if (element.slots) {
    look.contents = transferSlots(element.slots);
  }
  return look;
}

export function pasteComponentLook(
  target: ReviewConceptElement,
  sourceKind: ReviewConceptElement["kind"],
  look: ConceptStyleLook
): Partial<ReviewConceptElement> {
  const sameKind = sourceKind === target.kind;
  const patch: Partial<ReviewConceptElement> = {};
  for (const key of ELEMENT_STYLE_KEYS) {
    if (!INSTANCE_KEYS.has(key) && (sameKind || SHARED_KEYS.has(key))) {
      Object.assign(patch, { [key]: look[key] });
    }
  }
  if (!sameKind) {
    return patch;
  }
  if (target.kind === "group") {
    patch.group = slotLayout(
      look.groupContents ?? { elements: [] },
      target.group
    );
  }
  if (hasSlots(target.kind)) {
    patch.slots = transferSlots(look.contents ?? {}, target.slots);
  }
  if (target.kind === "table") {
    patch.table = {
      ...tableOf(target),
      borders: look.tableBorders,
      header: look.tableHeader,
    };
  }
  return patch;
}

/** A kit variant uses the component's layout around its standard starter content. */
export function newComponentStyleLook(
  element: ReviewConceptElement
): ConceptStyleLook {
  const look = lookOf(element);
  if (element.group) {
    look.groupContents = element.group.stateful
      ? element.group
      : slotLayout(element.group);
  }
  if (element.slots) {
    look.contents = transferSlots(
      element.slots,
      createConceptElement(element.kind).slots
    );
  }
  return look;
}
