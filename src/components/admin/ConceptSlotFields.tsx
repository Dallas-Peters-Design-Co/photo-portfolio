import { useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptSlot,
  type ConceptSlotAlign,
  type ConceptSlotJustify,
  type ConceptSlotLayout,
  type ConceptSlotName,
  SLOT_DEFAULTS,
  SLOT_LIMITS,
  SLOT_NAMES,
} from "../../../config/conceptSlots.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Checkbox } from "../ui/checkbox";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { ConceptElementList } from "./ConceptElementList";

const LAYOUTS = optionsOf([
  ["column", "Column"],
  ["row", "Row"],
  ["grid", "Grid"],
]);
const ALIGNS = optionsOf([
  ["start", "Start"],
  ["stretch", "Stretch"],
  ["center", "Center"],
  ["end", "End"],
]);
const JUSTIFIES = optionsOf([
  ["start", "Start"],
  ["center", "Center"],
  ["end", "End"],
  ["between", "Space between"],
]);
const SLOT_LABELS: Record<ConceptSlotName, string> = {
  body: "Body",
  footer: "Footer",
  header: "Header",
};

/** One slot: how it lays out what it holds, then what it holds. */
function SlotFields({
  brandDoc,
  depth,
  name,
  onChange,
  slot,
}: {
  brandDoc?: BrandKitDoc | null;
  depth: number;
  name: ConceptSlotName;
  onChange: (slot: ConceptSlot) => void;
  slot: ConceptSlot;
}) {
  const fillId = useId();
  const label = `${SLOT_LABELS[name]} slot`;
  const set = (patch: Partial<ConceptSlot>) => onChange({ ...slot, ...patch });
  const layout = slot.layout ?? "column";
  return (
    <div className="review-concepts__slot">
      <ConceptGroup name={label}>
        <ConceptField label="Layout">
          <ConceptSelect
            label={`${label} layout`}
            onChange={(next) => set({ layout: next as ConceptSlotLayout })}
            options={LAYOUTS}
            value={layout}
          />
        </ConceptField>
        {layout === "grid" ? (
          <NumberField
            label="Columns"
            max={SLOT_LIMITS.columns[1]}
            min={SLOT_LIMITS.columns[0]}
            onChange={(columns) => set({ columns })}
            value={slot.columns ?? SLOT_DEFAULTS.columns}
          />
        ) : null}
        <ConceptField label="Align">
          <ConceptSelect
            label={`${label} align`}
            onChange={(next) => set({ align: next as ConceptSlotAlign })}
            options={ALIGNS}
            value={slot.align ?? "start"}
          />
        </ConceptField>
        <label className="review-concepts__check" htmlFor={fillId}>
          <Checkbox
            checked={slot.fill ?? false}
            id={fillId}
            onChange={(event) => set({ fill: event.target.checked })}
          />
          <span>Fill the width</span>
        </label>
        <ConceptField label="Justify">
          <ConceptSelect
            label={`${label} justify`}
            onChange={(next) => set({ justify: next as ConceptSlotJustify })}
            options={JUSTIFIES}
            value={slot.justify ?? "start"}
          />
        </ConceptField>
        <NumberField
          label="Gap"
          max={SLOT_LIMITS.gap[1]}
          onChange={(gap) => set({ gap })}
          value={slot.gap ?? SLOT_DEFAULTS.gap}
        />
        <NumberField
          label="Padding X"
          max={SLOT_LIMITS.paddingX[1]}
          onChange={(paddingX) => set({ paddingX })}
          value={slot.paddingX ?? SLOT_DEFAULTS.paddingX}
        />
        <NumberField
          label="Padding Y"
          max={SLOT_LIMITS.paddingY[1]}
          onChange={(paddingY) => set({ paddingY })}
          value={slot.paddingY ?? SLOT_DEFAULTS.paddingY}
        />
      </ConceptGroup>
      <ConceptElementList
        brandDoc={brandDoc}
        depth={depth + 1}
        elements={slot.elements}
        label={`In the ${name}`}
        onChange={(elements) => set({ elements })}
      />
    </div>
  );
}

/**
 * A card's or panel's slots — header, body, footer — and whether lines
 * divide them. Each slot is its own layout with its own list of elements.
 */
export function ConceptSlotFields({
  brandDoc,
  depth,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  /** How many slots deep the card or panel itself sits. */
  depth: number;
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const dividersId = useId();
  const slots = element.slots ?? {};
  return (
    <>
      <ConceptGroup name="Slots">
        <label className="review-concepts__check" htmlFor={dividersId}>
          <Checkbox
            checked={element.dividers ?? false}
            id={dividersId}
            onChange={(event) => onChange({ dividers: event.target.checked })}
          />
          <span>Lines between slots</span>
        </label>
      </ConceptGroup>
      {SLOT_NAMES.map((name) => (
        <SlotFields
          brandDoc={brandDoc}
          depth={depth}
          key={name}
          name={name}
          onChange={(slot) => onChange({ slots: { ...slots, [name]: slot } })}
          slot={slots[name] ?? { elements: [] }}
        />
      ))}
    </>
  );
}
