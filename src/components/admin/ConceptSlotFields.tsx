import { useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  type ConceptSlot,
  type ConceptSlotAlign,
  type ConceptSlotJustify,
  type ConceptSlotLayout,
  type ConceptSlotName,
  LAYOUT_SLOTS,
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
import { Input } from "../ui/input";
import { ComponentStateFields } from "./ComponentStateFields";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { ConceptElementList } from "./ConceptElementList";
import { ConceptFlexFields } from "./ConceptFlexFields";
import { FlexAlignmentPicker } from "./FlexAlignmentPicker";

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
  hide: "Close button",
};
const PANEL_SLOTS: readonly ConceptSlotName[] = ["hide", ...LAYOUT_SLOTS];

/** A navbar's slots, as it lays them out: start, middle, end. */
const BAR_LABELS: Record<ConceptSlotName, string> = {
  ...SLOT_LABELS,
  body: "Middle",
  footer: "End",
  header: "Start",
};

const SLIDES = optionsOf([
  ["none", "Just appears"],
  ["right", "Slides in from the right"],
  ["left", "Slides in from the left"],
  ["top", "Slides down from the top"],
  ["bottom", "Slides up from the bottom"],
]);

function WrapField({
  slot,
  onChange,
}: {
  slot: ConceptSlot;
  onChange: (wrap: boolean) => void;
}) {
  const id = useId();
  if (slot.layout !== "row") {
    return null;
  }
  return (
    <label className="review-concepts__check" htmlFor={id}>
      <Checkbox
        checked={slot.wrap ?? true}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
      />
      Wrap items
    </label>
  );
}

function slotDestination(
  id: string | undefined,
  group: boolean,
  name: ConceptSlotName
) {
  if (!id) {
    return;
  }
  return { id, position: group ? ("inside" as const) : name };
}

/** One slot: how it lays out what it holds, then what it holds. */
export function SlotFields({
  brandDoc,
  depth,
  group = false,
  navbar = false,
  label: named,
  listLabel,
  ownerId,
  name = "body",
  onChange,
  slot,
}: {
  brandDoc?: BrandKitDoc | null;
  depth: number;
  /** A group's settings: it can span its row (Full width). */
  group?: boolean;
  navbar?: boolean;
  /** What the settings are headed: the slot's name, or "Group". */
  label?: string;
  /** What the list of elements is headed. */
  listLabel?: string;
  ownerId?: string;
  name?: ConceptSlotName;
  onChange: (slot: ConceptSlot) => void;
  slot: ConceptSlot;
}) {
  const fillId = useId();
  const fullId = useId();
  const label = named ?? `${SLOT_LABELS[name]} slot`;
  const set = (patch: Partial<ConceptSlot>) => onChange({ ...slot, ...patch });
  const middle = name === "body" ? 1 : 0;
  const layout = slot.layout ?? "column";
  return (
    <div className="review-concepts__slot">
      <ConceptGroup compact name={label}>
        <ConceptField label="Layout">
          <ConceptSelect
            label={`${label} layout`}
            onChange={(next) => set({ layout: next as ConceptSlotLayout })}
            options={LAYOUTS}
            value={layout}
          />
        </ConceptField>
        <WrapField onChange={(wrap) => set({ wrap })} slot={slot} />
        {layout === "grid" ? (
          <NumberField
            label="Columns"
            max={SLOT_LIMITS.columns[1]}
            min={SLOT_LIMITS.columns[0]}
            onChange={(columns) => set({ columns })}
            value={slot.columns ?? SLOT_DEFAULTS.columns}
          />
        ) : null}
        {layout === "grid" ? (
          <>
            <ConceptField label="Align">
              <ConceptSelect
                label={`${label} align`}
                onChange={(next) => set({ align: next as ConceptSlotAlign })}
                options={ALIGNS}
                value={slot.align ?? "start"}
              />
            </ConceptField>
            <ConceptField label="Justify">
              <ConceptSelect
                label={`${label} justify`}
                onChange={(next) =>
                  set({ justify: next as ConceptSlotJustify })
                }
                options={JUSTIFIES}
                value={slot.justify ?? "start"}
              />
            </ConceptField>
          </>
        ) : (
          <FlexAlignmentPicker
            label={label}
            layout={layout}
            onChange={set}
            slot={slot}
          />
        )}
        {group ? (
          <>
            <ComponentStateFields change={set} group={slot} />
            <ConceptField label="Collapsible row label">
              <Input
                aria-label="Collapsible row label"
                maxLength={120}
                onChange={(event) =>
                  set({ disclosureLabel: event.target.value })
                }
                placeholder="Row label"
                value={slot.disclosureLabel ?? ""}
              />
            </ConceptField>
            <label className="review-concepts__check" htmlFor={fullId}>
              <Checkbox
                checked={slot.full ?? false}
                id={fullId}
                onChange={(event) => set({ full: event.target.checked })}
              />
              <span>Full width</span>
            </label>
          </>
        ) : null}
        <label className="review-concepts__check" htmlFor={fillId}>
          <Checkbox
            checked={slot.fill ?? false}
            id={fillId}
            onChange={(event) => set({ fill: event.target.checked })}
          />
          <span>Fill available width</span>
        </label>
        <NumberField
          label="Gap"
          max={SLOT_LIMITS.gap[1]}
          onChange={(gap) => set({ gap })}
          value={slot.gap ?? SLOT_DEFAULTS.gap}
        />
        <NumberField
          label="Padding X"
          onChange={(paddingX) => set({ paddingX })}
          value={slot.paddingX ?? SLOT_DEFAULTS.paddingX}
        />
        <NumberField
          label="Padding Y"
          onChange={(paddingY) => set({ paddingY })}
          value={slot.paddingY ?? SLOT_DEFAULTS.paddingY}
        />
      </ConceptGroup>
      {navbar ? (
        <ConceptFlexFields
          flex={slot.flex}
          grow={middle}
          onChange={(flex) => set({ flex })}
          shrink={middle}
        />
      ) : null}
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
        destination={slotDestination(ownerId, group, name)}
        elements={slot.elements}
        initiallyOpen={name === "hide"}
        label={
          listLabel ??
          (name === "hide" ? "Close button style" : `In the ${name}`)
        }
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
  if (element.kind === "accordion") {
    return (
      <>
        <ConceptField label="State">
          <ConceptSelect
            label="Accordion state"
            onChange={(value) =>
              onChange({ accordionExpanded: value === "expanded" })
            }
            options={[
              { label: "Collapsed", value: "collapsed" },
              { label: "Expanded", value: "expanded" },
            ]}
            value={element.accordionExpanded ? "expanded" : "collapsed"}
          />
        </ConceptField>
        {(["header", "body"] as const).map((name) => {
          const label = name === "header" ? "Summary" : "Details";
          return (
            <SlotFields
              brandDoc={brandDoc}
              depth={depth}
              key={name}
              label={`${label} slot`}
              listLabel={`In the ${label.toLowerCase()}`}
              name={name}
              onChange={(slot) =>
                onChange({ slots: { ...slots, [name]: slot } })
              }
              ownerId={element.id}
              slot={slots[name] ?? { elements: [] }}
            />
          );
        })}
      </>
    );
  }
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
          <ConceptField label="Toggle position" wide>
            <ConceptSelect
              label="Panel toggle position"
              onChange={(value) =>
                onChange({
                  panelToggleSide: value === "left" ? "left" : "right",
                })
              }
              options={[
                { label: "Left", value: "left" },
                { label: "Right", value: "right" },
              ]}
              value={element.panelToggleSide ?? "right"}
            />
          </ConceptField>
          <ConceptField label="Initial state" wide>
            <ConceptSelect
              label="Panel initial state"
              onChange={(value) =>
                onChange({ panelCollapsed: value === "collapsed" })
              }
              options={[
                { label: "Expanded", value: "expanded" },
                { label: "Collapsed", value: "collapsed" },
              ]}
              value={element.panelCollapsed ? "collapsed" : "expanded"}
            />
          </ConceptField>
        </ConceptGroup>
      ) : null}
      {(element.kind === "panel" ? PANEL_SLOTS : SLOT_NAMES)
        .filter((name) => name !== "hide" || element.kind === "panel")
        .map((name) => (
          <SlotFields
            brandDoc={brandDoc}
            depth={depth}
            key={name}
            label={
              element.kind === "navbar" ? `${BAR_LABELS[name]} slot` : undefined
            }
            name={name}
            navbar={element.kind === "navbar"}
            onChange={(slot) => onChange({ slots: { ...slots, [name]: slot } })}
            ownerId={element.id}
            slot={slots[name] ?? { elements: [] }}
          />
        ))}
    </>
  );
}
