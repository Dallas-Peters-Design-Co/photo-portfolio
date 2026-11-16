import type { CSSProperties, ReactNode } from "react";
import {
  type ConceptSlot,
  type ConceptSlotName,
  type ConceptSlots,
  SLOT_DEFAULTS,
  SLOT_NAMES,
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

/** A slot's layout as CSS: flex for a row or column, grid for a grid. */
const slotStyle = (slot: ConceptSlot): CSSProperties => {
  const layout = slot.layout ?? "column";
  const base: CSSProperties = {
    alignItems: slot.align ? ALIGN[slot.align] : undefined,
    gap: slot.gap ?? SLOT_DEFAULTS.gap,
    justifyContent: slot.justify ? JUSTIFY[slot.justify] : undefined,
    padding: `${slot.paddingY ?? SLOT_DEFAULTS.paddingY}px ${slot.paddingX ?? SLOT_DEFAULTS.paddingX}px`,
  };
  return layout === "grid"
    ? {
        ...base,
        gridTemplateColumns: `repeat(${slot.columns ?? SLOT_DEFAULTS.columns}, minmax(0, 1fr))`,
      }
    : base;
};

function Slot({
  draw,
  lead,
  name,
  slot,
}: {
  draw: Draw;
  /** Drawn first in the slot: a panel's title in its header. */
  lead?: ReactNode;
  name: ConceptSlotName;
  slot?: ConceptSlot;
}) {
  if (!(lead || slot?.elements.length)) {
    return null;
  }
  const layout = slot?.layout ?? (lead ? "row" : "column");
  return (
    <div
      className="concept-slot"
      data-direction={layout === "row" ? "row" : "column"}
      data-layout={layout}
      data-slot={name}
      style={slot ? slotStyle(slot) : undefined}
    >
      {lead}
      {/* draw keys each element by its id. */}
      {slot?.elements.map(draw)}
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
  title,
}: {
  dividers?: boolean;
  draw: Draw;
  slots?: ConceptSlots;
  /** A panel's title, at the start of its header. */
  title?: ReactNode;
}) {
  return (
    <div className="concept-slots" data-dividers={dividers || undefined}>
      {SLOT_NAMES.map((name) => (
        <Slot
          draw={draw}
          key={name}
          lead={name === "header" ? title : undefined}
          name={name}
          slot={slots[name]}
        />
      ))}
    </div>
  );
}
