import { type ConceptFlex, cleanFlex } from "./conceptFlex.js";
import { PANEL_CHEVRON } from "./conceptIcon.js";
import { bounded } from "./conceptValues.js";
import type {
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "./reviewConcept.js";

/**
 * Slots: the places inside a card or panel that hold other elements. Each
 * slot has its own layout — a row, a column or a grid, with its gap, padding
 * and alignment — and its own list of elements, any kind, in any mix.
 *
 * A card or panel draws header, body and footer in that order. Its own text
 * (a card's icon, title and body; a panel's title) leads the header. An
 * empty slot is not drawn, and a header with no text and nothing in it is
 * not drawn either.
 */

export const SLOT_NAMES = ["header", "body", "footer", "hide"] as const;
export type ConceptSlotName = (typeof SLOT_NAMES)[number];

/**
 * The slots laid out top to bottom. `hide` is a panel's own: what it holds
 * (a close button, an ✕) sits in the panel's top-right corner, and a click
 * on it slides the panel away (src/components/review/ConceptPanelPreview).
 */
export const LAYOUT_SLOTS = ["header", "body", "footer"] as const;

/** Where a panel slides in from as it appears, and back out to. */
export const SLIDE_SIDES = ["right", "left", "top", "bottom"] as const;
export type SlideSide = (typeof SLIDE_SIDES)[number];

export const SLOT_LAYOUTS = ["column", "row", "grid"] as const;
export type ConceptSlotLayout = (typeof SLOT_LAYOUTS)[number];

export const SLOT_ALIGNS = ["start", "center", "end", "stretch"] as const;
export type ConceptSlotAlign = (typeof SLOT_ALIGNS)[number];

export const SLOT_JUSTIFIES = ["start", "center", "end", "between"] as const;
export type ConceptSlotJustify = (typeof SLOT_JUSTIFIES)[number];

export interface ConceptSlot {
  /** Cross-axis alignment of the slot's elements. Default start. */
  align?: ConceptSlotAlign;
  /** Grid only: how many equal columns. */
  columns?: number;
  elements: ReviewConceptElement[];
  /** Each element grows to share the slot's full width. */
  fill?: boolean;
  flex?: ConceptFlex;
  /**
   * Groups only: the group spans its row, its elements keeping their own
   * size, so Align and Justify place them (Fill, which stretches each one,
   * is separate).
   */
  full?: boolean;
  gap?: number;
  /** Main-axis distribution: "between" pushes the first and last apart. */
  justify?: ConceptSlotJustify;
  layout?: ConceptSlotLayout;
  paddingX?: number;
  paddingY?: number;
  wrap?: boolean;
}

export type ConceptSlots = Partial<Record<ConceptSlotName, ConceptSlot>>;

export const SLOT_LIMITS = {
  columns: [1, 6],
  gap: [0, 48],
  paddingX: [0, Number.POSITIVE_INFINITY],
  paddingY: [0, Number.POSITIVE_INFINITY],
} as const;

export const SLOT_DEFAULTS = {
  columns: 2,
  gap: 8,
  paddingX: 0,
  paddingY: 0,
} as const;

/** The kinds that have slots. */
const SLOT_KINDS = new Set<ReviewConceptElementKind>([
  "card",
  "panel",
  // A navbar's header, body and footer are its start, middle and end.
  "navbar",
]);

export const hasSlots = (kind: ReviewConceptElementKind): boolean =>
  SLOT_KINDS.has(kind);

/**
 * How deep slots go: a panel can hold a card, and that card's slots can hold
 * plain elements, but nothing in them has slots of its own.
 */
export const MAX_SLOT_DEPTH = 2;
export const MAX_SLOT_ELEMENTS = 24;

const oneOf = <T extends string>(
  options: readonly T[],
  value: unknown
): T | undefined => (options.includes(value as T) ? (value as T) : undefined);

const number = (
  key: keyof typeof SLOT_LIMITS,
  value: unknown
): Partial<Record<keyof typeof SLOT_LIMITS, number>> =>
  typeof value === "number"
    ? {
        [key]: bounded(
          value,
          SLOT_LIMITS[key][0],
          SLOT_LIMITS[key][1],
          SLOT_DEFAULTS[key]
        ),
      }
    : {};

/** One slot (or a group, which is laid out the same way), its elements cleaned. */
export const cleanSlot = (
  value: unknown,
  depth: number,
  cleanElement: (value: unknown, depth: number) => ReviewConceptElement
): ConceptSlot => {
  const slot = (value ?? {}) as Partial<ConceptSlot>;
  const align = oneOf(SLOT_ALIGNS, slot.align);
  const justify = oneOf(SLOT_JUSTIFIES, slot.justify);
  const layout = oneOf(SLOT_LAYOUTS, slot.layout);
  return {
    ...cleanFlex(slot.flex),
    ...(typeof slot.wrap === "boolean" ? { wrap: slot.wrap } : {}),
    ...(align ? { align } : {}),
    ...number("columns", slot.columns),
    elements: (Array.isArray(slot.elements) ? slot.elements : [])
      .slice(0, MAX_SLOT_ELEMENTS)
      .map((element) => cleanElement(element, depth + 1)),
    ...(slot.fill === true ? { fill: true } : {}),
    ...(slot.full === true ? { full: true } : {}),
    ...number("gap", slot.gap),
    ...(justify ? { justify } : {}),
    ...(layout ? { layout } : {}),
    ...number("paddingX", slot.paddingX),
    ...number("paddingY", slot.paddingY),
  };
};

/**
 * How deep groups go: a group in a panel's slot can hold a group, and so on
 * a few levels, but not without end.
 */
export const MAX_GROUP_DEPTH = 4;

/**
 * An element with each element it holds, in its slots or its group, changed
 * by `map`. The one walk every pass over a concept's tree uses (styling,
 * copying, icons), so a new kind of holder is added here once.
 */
export const mapChildren = (
  element: ReviewConceptElement,
  map: (child: ReviewConceptElement) => ReviewConceptElement
): ReviewConceptElement => ({
  ...element,
  ...(element.slots ? { slots: mapSlotElements(element.slots, map) } : {}),
  ...(element.group
    ? { group: { ...element.group, elements: element.group.elements.map(map) } }
    : {}),
});

/**
 * A card's or panel's slots, each element cleaned one level deeper by the
 * cleaner passed in (cleanElement, which calls this — so it is passed rather
 * than imported).
 */
export const cleanSlots = (
  value: unknown,
  depth: number,
  cleanElement: (value: unknown, depth: number) => ReviewConceptElement
): ConceptSlots | undefined => {
  if (depth >= MAX_SLOT_DEPTH || !value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, Partial<ConceptSlot> | undefined>;
  const slots: ConceptSlots = {};
  for (const name of SLOT_NAMES) {
    const slot = raw[name];
    // A slot set up before anything is put in it keeps its layout.
    if (slot && typeof slot === "object") {
      slots[name] = cleanSlot(slot, depth, cleanElement);
    }
  }
  return Object.keys(slots).length > 0 ? slots : undefined;
};

/** Every slot's elements, each changed by `map`; the rest of each slot kept. */
export const mapSlotElements = (
  slots: ConceptSlots,
  map: (element: ReviewConceptElement) => ReviewConceptElement
): ConceptSlots =>
  Object.fromEntries(
    Object.entries(slots).map(([name, slot]) => [
      name,
      slot ? { ...slot, elements: slot.elements.map(map) } : slot,
    ])
  ) as ConceptSlots;

/** Every element in a list and in its slots, at any depth: for loading fonts. */
export const everyElement = (
  elements: ReviewConceptElement[]
): ReviewConceptElement[] =>
  elements.flatMap((element) => [
    element,
    ...everyElement([
      ...Object.values(element.slots ?? {}).flatMap(
        (slot) => slot?.elements ?? []
      ),
      ...(element.group?.elements ?? []),
    ]),
  ]);

/** Apply the directional glyph to existing kit controls while keeping their button styling. */
export function panelHandleElements(
  element: ReviewConceptElement
): ReviewConceptElement[] {
  return (element.slots?.hide?.elements ?? []).map((child) =>
    child.kind === "icon" || child.kind === "button"
      ? { ...child, ...PANEL_CHEVRON }
      : child
  );
}
