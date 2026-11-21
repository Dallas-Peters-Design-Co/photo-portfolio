import type { CSSProperties, ReactNode } from "react";
import {
  groupDisclosure,
  initialState,
} from "../../../config/componentStates.js";
import { flexSize } from "../../../config/conceptFlex.js";
import { gridItemStyle } from "../../../config/conceptGridItem.js";
import {
  type ConceptSlot,
  type ConceptSlotName,
  type ConceptSlots,
  LAYOUT_SLOTS,
  SLOT_DEFAULTS,
} from "../../../config/conceptSlots.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { CollapsibleCardRow } from "./CollapsibleCardRow";
import { ComponentStateView } from "./ComponentStateView";
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
    ...(slot.layout === "row" && slot.wrap !== undefined
      ? { flexWrap: slot.wrap ? "wrap" : "nowrap" }
      : {}),
    alignContent:
      slot.layout === "row" && slot.align ? ALIGN[slot.align] : undefined,
    alignItems: slot.align ? ALIGN[slot.align] : undefined,
    gap: slot.gap ?? SLOT_DEFAULTS.gap,
    justifyContent: slot.justify ? JUSTIFY[slot.justify] : undefined,
  };
  return slot.layout === "grid"
    ? {
        ...base,
        gridTemplateColumns: `repeat(${slot.columns ?? SLOT_DEFAULTS.columns}, minmax(0, 1fr))`,
        justifyItems:
          slot.fill || slot.justify === "between" ? undefined : slot.justify,
      }
    : base;
};

/** A slot's elements, laid out the slot's way. */
function Items({
  className,
  lead,
  draw,
  slot,
}: {
  className?: string;
  lead?: ReactNode;
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
      {lead}
      {/* draw keys each element by its id. */}
      {slot.elements.map((element) =>
        layout === "grid" && element.gridPlacement ? (
          <div
            className="concept-grid-item"
            key={element.id}
            style={gridItemStyle(
              element.gridPlacement,
              slot.columns ?? SLOT_DEFAULTS.columns
            )}
          >
            {draw(element)}
          </div>
        ) : (
          draw(element)
        )
      )}
    </div>
  );
}

/**
 * One slot, with its padding. In a header that has a lead (the element's
 * own text), the lead takes the start of the full width and the slot's
 * elements sit together at the end, laid out the slot's way.
 */
export function Slot({
  background,
  draw,
  lead,
  end,
  includeLead,
  spacer,
  name,
  slot,
}: {
  draw: Draw;
  /** A card's or panel's own text, at the start of its header. */
  lead?: ReactNode;
  end?: ReactNode;
  includeLead?: boolean;
  spacer?: boolean;
  background?: string;
  name: ConceptSlotName;
  slot?: ConceptSlot;
}) {
  const filled = slot?.elements.length ? slot : undefined;
  if (!(lead || filled || end || spacer || slot?.flex)) {
    return null;
  }
  const outsideLead = includeLead ? null : lead;
  const slotPadding = slot ? padding(slot) : undefined;
  return (
    <div
      className="concept-slot"
      data-led={(!includeLead && lead) || end ? true : undefined}
      data-slot={name}
      style={{
        backgroundColor: background,
        flex: slot?.flex ? flexSize(slot.flex) : undefined,
        gap: slot?.gap ?? SLOT_DEFAULTS.gap,
        padding: slotPadding ?? (end ? "8px" : undefined),
      }}
    >
      {outsideLead}
      {filled || (includeLead && lead) ? (
        <Items
          draw={draw}
          lead={includeLead ? lead : undefined}
          slot={slot ?? { elements: [] }}
        />
      ) : null}
      {end}
    </div>
  );
}

/**
 * A card's or panel's slots in order — header, body, footer — each laid out
 * its own way, with a line between them when the element asks for one.
 */
export function ConceptSlotsView({
  bar = false,
  bodyDraw,
  dividers = false,
  draw,
  slots = {},
  lead,
  headerEnd,
  headerBackground,
  titleInLayout = false,
}: {
  /**
   * A navbar: header, body and footer side by side as its start, middle and
   * end, the middle taking the free width.
   */
  bar?: boolean;
  bodyDraw?: Draw;
  dividers?: boolean;
  draw: Draw;
  slots?: ConceptSlots;
  /**
   * A card's icon and title, or a panel's title: the start of the
   * header, which then spans the element even with nothing else in it.
   */
  lead?: ReactNode;
  /** A panel's close control, beside the header rather than over it. */
  headerEnd?: ReactNode;
  headerBackground?: string;
  titleInLayout?: boolean;
}) {
  return (
    <div
      className="concept-slots"
      data-bar={bar || undefined}
      data-dividers={dividers || undefined}
    >
      {LAYOUT_SLOTS.map((name) => {
        let slotLead: ReactNode;
        if (name === "header") {
          slotLead = lead;
        } else {
          slotLead = null;
        }
        return (
          <Slot
            background={name === "header" ? headerBackground : undefined}
            draw={name === "body" ? (bodyDraw ?? draw) : draw}
            end={name === "header" ? headerEnd : undefined}
            includeLead={name === "header" && titleInLayout}
            key={name}
            lead={slotLead}
            name={name}
            slot={slots[name]}
            spacer={bar && name === "body"}
          />
        );
      })}
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
  const group = {
    ...(element.group ?? { elements: [] }),
    wrap: element.group?.wrap ?? false,
  };
  const disclosure = groupDisclosure(group);
  const items = group.stateful ? (
    <ComponentStateView
      draw={(elements) => (
        <Items
          className="concept-group__items"
          draw={draw}
          slot={{ ...group, elements }}
        />
      )}
      group={group}
      key={initialState(group)}
    />
  ) : (
    <Items className="concept-group__items" draw={draw} slot={group} />
  );
  return (
    <div
      className="concept-group"
      data-full={group.full || undefined}
      style={{ ...style, padding: padding(group) }}
    >
      {disclosure ? (
        <CollapsibleCardRow label={disclosure}>{items}</CollapsibleCardRow>
      ) : (
        items
      )}
    </div>
  );
}
