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
 * A panel draws header, body and footer in that order, with its title at the
 * start of the header. A card draws its icon, title and body first, then the
 * same three slots. An empty slot is not drawn.
 */

export const SLOT_NAMES = ["header", "body", "footer"] as const;
export type ConceptSlotName = (typeof SLOT_NAMES)[number];

export const SLOT_LAYOUTS = ["column", "row", "grid"] as const;
export type ConceptSlotLayout = (typeof SLOT_LAYOUTS)[number];

export const SLOT_ALIGNS = ["start", "center", "end", "stretch"] as const;
export type ConceptSlotAlign = (typeof SLOT_ALIGNS)[number];

export const SLOT_JUSTIFIES = ["start", "center", "end", "between"] as const;
export type ConceptSlotJustify = (typeof SLOT_JUSTIFIES)[number];

export interface ConceptSlot {
  /** Cross-axis alignment of the slot's elements. Default stretch in a column. */
  align?: ConceptSlotAlign;
  /** Grid only: how many equal columns. */
  columns?: number;
  elements: ReviewConceptElement[];
  gap?: number;
  /** Main-axis distribution: "between" pushes the first and last apart. */
  justify?: ConceptSlotJustify;
  layout?: ConceptSlotLayout;
  paddingX?: number;
  paddingY?: number;
}

export type ConceptSlots = Partial<Record<ConceptSlotName, ConceptSlot>>;

export const SLOT_LIMITS = {
  columns: [1, 6],
  gap: [0, 48],
  paddingX: [0, 48],
  paddingY: [0, 48],
} as const;

export const SLOT_DEFAULTS = {
  columns: 2,
  gap: 8,
  paddingX: 0,
  paddingY: 0,
} as const;

/** The kinds that have slots. */
const SLOT_KINDS = new Set<ReviewConceptElementKind>(["card", "panel"]);

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
    if (!slot || typeof slot !== "object") {
      continue;
    }
    const align = oneOf(SLOT_ALIGNS, slot.align);
    const justify = oneOf(SLOT_JUSTIFIES, slot.justify);
    const layout = oneOf(SLOT_LAYOUTS, slot.layout);
    slots[name] = {
      ...(align ? { align } : {}),
      ...number("columns", slot.columns),
      elements: (Array.isArray(slot.elements) ? slot.elements : [])
        .slice(0, MAX_SLOT_ELEMENTS)
        .map((element) => cleanElement(element, depth + 1)),
      ...number("gap", slot.gap),
      ...(justify ? { justify } : {}),
      ...(layout ? { layout } : {}),
      ...number("paddingX", slot.paddingX),
      ...number("paddingY", slot.paddingY),
    };
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
    ...everyElement(
      Object.values(element.slots ?? {}).flatMap((slot) => slot?.elements ?? [])
    ),
  ]);
