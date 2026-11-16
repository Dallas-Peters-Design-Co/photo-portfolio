import type { CSSProperties, ReactNode } from "react";
import {
  type ConceptSlot,
  type ConceptSlotName,
  type ConceptSlots,
  LAYOUT_SLOTS,
  SLOT_DEFAULTS,
} from "../../../config/conceptSlots.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import "./ConceptSlotsView.css";

type Draw = (element: ReviewConceptElement) => ReactNode;

const JUSTIFY = {
  between: "space-between",
  center: "center",
  end: "flex-end",
  start: "flex-start",
} as const;

const ALIGN = {
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
} as const;

const padding = (slot: ConceptSlot): string =>
  `${slot.paddingY ?? SLOT_DEFAULTS.paddingY}px ${slot.paddingX ?? SLOT_DEFAULTS.paddingX}px`;

/** How a slot lays out its elements: flex for a row or column, else grid. */
const itemsStyle = (slot: ConceptSlot): CSSProperties => {
  const base: CSSProperties = {
    alignItems: slot.align ? ALIGN[slot.align] : undefined,
    gap: slot.gap ?? SLOT_DEFAULTS.gap,
    justifyContent: slot.justify ? JUSTIFY[slot.justify] : undefined,
  };
  return slot.layout === "grid"
    ? {
        ...base,
        gridTemplateColumns: `repeat(${slot.columns ?? SLOT_DEFAULTS.columns}, minmax(0, 1fr))`,
      }
    : base;
};

/** A slot's elements, laid out the slot's way. */
function Items({
  className,
  draw,
  slot,
}: {
  className?: string;
  draw: Draw;
  slot: ConceptSlot;
}) {
  const layout = slot.layout ?? "column";
  return (
    <div
      className={
        className ? `concept-slot__items ${className}` : "concept-slot__items"
      }
      data-direction={layout === "row" ? "row" : "column"}
      data-fill={slot.fill || undefined}
      data-layout={layout}
      style={itemsStyle(slot)}
    >
      {/* draw keys each element by its id. */}
      {slot.elements.map(draw)}
    </div>
  );
}

/**
 * One slot, with its padding. In a header that has a lead (the element's
 * own text), the lead takes the start of the full width and the slot's
 * elements sit together at the end, laid out the slot's way.
 */
function Slot({
  draw,
  lead,
  name,
  slot,
}: {
  draw: Draw;
  /** A card's or panel's own text, at the start of its header. */
  lead?: ReactNode;
  name: ConceptSlotName;
  slot?: ConceptSlot;
}) {
  const filled = slot?.elements.length ? slot : undefined;
  if (!(lead || filled)) {
    return null;
  }
  return (
    <div
      className="concept-slot"
      data-led={lead ? true : undefined}
      data-slot={name}
      style={{
        gap: slot?.gap ?? SLOT_DEFAULTS.gap,
        padding: slot ? padding(slot) : undefined,
      }}
    >
      {lead}
      {filled ? <Items draw={draw} slot={filled} /> : null}
    </div>
  );
}

/**
 * A card's or panel's slots in order — header, body, footer — each laid out
 * its own way, with a line between them when the element asks for one.
 */
export function ConceptSlotsView({
  dividers = false,
  draw,
  slots = {},
  lead,
}: {
  dividers?: boolean;
  draw: Draw;
  slots?: ConceptSlots;
  /**
   * A card's icon, title and body, or a panel's title: the start of the
   * header, which then spans the element even with nothing else in it.
   */
  lead?: ReactNode;
}) {
  return (
    <div className="concept-slots" data-dividers={dividers || undefined}>
      {LAYOUT_SLOTS.map((name) => (
        <Slot
          draw={draw}
          key={name}
          lead={name === "header" ? lead : undefined}
          name={name}
          slot={slots[name]}
        />
      ))}
    </div>
  );
}

/**
 * A group: elements kept together in a slot (or anywhere), laid out the way
 * a slot lays out its own — row, column or grid, gap, alignment, padding.
 */
export function ConceptGroupView({
  draw,
  element,
  style,
}: {
  draw: Draw;
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const group = element.group ?? { elements: [] };
  return (
    <div
      className="concept-group"
      data-full={group.full || undefined}
      style={{ ...style, padding: padding(group) }}
    >
      <Items className="concept-group__items" draw={draw} slot={group} />
    </div>
  );
}
