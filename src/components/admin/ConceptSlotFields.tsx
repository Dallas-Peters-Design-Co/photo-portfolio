import { useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  type ConceptSlot,
  type ConceptSlotAlign,
  type ConceptSlotJustify,
  type ConceptSlotLayout,
  type ConceptSlotName,
  SLIDE_SIDES,
  SLOT_DEFAULTS,
  SLOT_LIMITS,
  SLOT_NAMES,
  type SlideSide,
} from "../../../config/conceptSlots.js";
import { closeButton } from "../../../config/conceptStarters.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
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
  hide: "Hide button",
};

const SLIDES = optionsOf([
  ["none", "Just appears"],
  ["right", "Slides in from the right"],
  ["left", "Slides in from the left"],
  ["top", "Slides down from the top"],
  ["bottom", "Slides up from the bottom"],
]);

/** One slot: how it lays out what it holds, then what it holds. */
export function SlotFields({
  brandDoc,
  depth,
  label: named,
  listLabel,
  name = "body",
  onChange,
  slot,
}: {
  brandDoc?: BrandKitDoc | null;
  depth: number;
  /** What the settings are headed: the slot's name, or "Group". */
  label?: string;
  /** What the list of elements is headed. */
  listLabel?: string;
  name?: ConceptSlotName;
  onChange: (slot: ConceptSlot) => void;
  slot: ConceptSlot;
}) {
  const fillId = useId();
  const label = named ?? `${SLOT_LABELS[name]} slot`;
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
      {name === "hide" && slot.elements.length === 0 ? (
        <Button
          onClick={() =>
            set({ elements: [closeButton(createConceptElement, brandDoc)] })
          }
          size="xs"
          type="button"
          variant="outline"
        >
          Add ✕ close button
        </Button>
      ) : null}
      <ConceptElementList
        brandDoc={brandDoc}
        depth={depth + 1}
        elements={slot.elements}
        label={listLabel ?? `In the ${name}`}
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
      {element.kind === "panel" ? (
        <ConceptGroup name="Motion">
          <ConceptField label="Appears" wide>
            <ConceptSelect
              label="How the panel appears"
              onChange={(value) =>
                onChange({
                  slideFrom: SLIDE_SIDES.includes(value as SlideSide)
                    ? (value as SlideSide)
                    : undefined,
                })
              }
              options={SLIDES}
              value={element.slideFrom ?? "none"}
            />
          </ConceptField>
          <p className="review-concepts__hint">
            Put a close button or ✕ in the Hide button slot: it sits in the
            top-right corner, and clicking it slides the panel away.
          </p>
        </ConceptGroup>
      ) : null}
      {SLOT_NAMES.filter(
        (name) => name !== "hide" || element.kind === "panel"
      ).map((name) => (
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
