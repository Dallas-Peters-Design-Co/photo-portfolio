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
  type SlotStyleField,
  slotStyleProp,
} from "../../../config/conceptSlots.js";
import { closeButton } from "../../../config/conceptStarters.js";
import type { ConceptStyleProp } from "../../../config/conceptStyle.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
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

const gridColumnsOf = (layout: ConceptSlotLayout, slot: ConceptSlot) =>
  layout === "grid" ? (slot.columns ?? SLOT_DEFAULTS.columns) : undefined;

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

function SlotLayoutControls({
  group,
  label,
  layout,
  onChange,
  showSlotProp,
  slot,
}: {
  group: boolean;
  label: string;
  layout: ConceptSlotLayout;
  onChange: (patch: Partial<ConceptSlot>) => void;
  showSlotProp: (field: SlotStyleField) => boolean;
  slot: ConceptSlot;
}) {
  const fillId = useId();
  const wrapId = useId();
  const alignment = () => {
    if (!showSlotProp("alignment")) {
      return null;
    }
    if (layout === "grid") {
      return (
        <>
          <ConceptField label="Align">
            <ConceptSelect
              label={`${label} align`}
              onChange={(next) => onChange({ align: next as ConceptSlotAlign })}
              options={ALIGNS}
              value={slot.align ?? "start"}
            />
          </ConceptField>
          <ConceptField label="Justify">
            <ConceptSelect
              label={`${label} justify`}
              onChange={(next) =>
                onChange({ justify: next as ConceptSlotJustify })
              }
              options={JUSTIFIES}
              value={slot.justify ?? "start"}
            />
          </ConceptField>
        </>
      );
    }
    return (
      <FlexAlignmentPicker
        label={label}
        layout={layout}
        onChange={onChange}
        slot={slot}
      />
    );
  };

  return (
    <>
      {showSlotProp("layout") ? (
        <ConceptField label="Layout">
          <ConceptSelect
            label={`${label} layout`}
            onChange={(next) => onChange({ layout: next as ConceptSlotLayout })}
            options={LAYOUTS}
            value={layout}
          />
        </ConceptField>
      ) : null}
      {showSlotProp("wrap") && layout === "row" ? (
        <label className="review-concepts__check" htmlFor={wrapId}>
          <Checkbox
            checked={slot.wrap ?? !group}
            id={wrapId}
            onChange={(event) => onChange({ wrap: event.target.checked })}
          />
          Wrap items
        </label>
      ) : null}
      {showSlotProp("columns") && layout === "grid" ? (
        <NumberField
          label="Columns"
          max={SLOT_LIMITS.columns[1]}
          min={SLOT_LIMITS.columns[0]}
          onChange={(columns) => onChange({ columns })}
          value={slot.columns ?? SLOT_DEFAULTS.columns}
        />
      ) : null}
      {alignment()}
      {showSlotProp("fill") ? (
        <label className="review-concepts__check" htmlFor={fillId}>
          <Checkbox
            checked={slot.fill ?? false}
            id={fillId}
            onChange={(event) => onChange({ fill: event.target.checked })}
          />
          <span>Fill available width</span>
        </label>
      ) : null}
      {showSlotProp("gap") ? (
        <NumberField
          label="Gap"
          max={SLOT_LIMITS.gap[1]}
          onChange={(gap) => onChange({ gap })}
          value={slot.gap ?? SLOT_DEFAULTS.gap}
        />
      ) : null}
      {showSlotProp("paddingX") ? (
        <NumberField
          label="Padding X"
          onChange={(paddingX) => onChange({ paddingX })}
          value={slot.paddingX ?? SLOT_DEFAULTS.paddingX}
        />
      ) : null}
      {showSlotProp("paddingY") ? (
        <NumberField
          label="Padding Y"
          onChange={(paddingY) => onChange({ paddingY })}
          value={slot.paddingY ?? SLOT_DEFAULTS.paddingY}
        />
      ) : null}
    </>
  );
}

/** One slot: how it lays out what it holds, then what it holds. */
export function SlotFields({
  brandDoc,
  depth,
  group = false,
  navbar = false,
  label: named,
  listLabel,
  showAllProps = false,
  ownerId,
  name = "body",
  onChange,
  showSlotProp,
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
  /** Show all controls for children in the brand kit style editor. */
  showAllProps?: boolean;
  ownerId?: string;
  name?: ConceptSlotName;
  onChange: (slot: ConceptSlot) => void;
  showSlotProp?: (field: SlotStyleField) => boolean;
  slot: ConceptSlot;
}) {
  const fullId = useId();
  const label = named ?? `${SLOT_LABELS[name]} slot`;
  const set = (patch: Partial<ConceptSlot>) => onChange({ ...slot, ...patch });
  const middle = name === "body" ? 1 : 0;
  const layout = slot.layout ?? "column";
  const show = showSlotProp ?? (() => true);
  return (
    <div className="review-concepts__slot">
      <ConceptGroup compact name={label}>
        {group ? (
          <>
            <ComponentStateFields change={set} group={slot} />
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
        <SlotLayoutControls
          group={group}
          label={label}
          layout={layout}
          onChange={set}
          showSlotProp={show}
          slot={slot}
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
        gridColumns={gridColumnsOf(layout, slot)}
        initiallyOpen={name === "hide"}
        label={
          listLabel ??
          (name === "hide" ? "Close button style" : `In the ${name}`)
        }
        onChange={(elements) => set({ elements })}
        showAllProps={showAllProps}
      />
    </div>
  );
}

/**
 * A card's or panel's slots — header, body, footer — and whether lines
 * divide them. Each slot is its own layout with its own list of elements.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: kind-specific state controls sit beside slots that remain independently editable
export function ConceptSlotFields({
  brandDoc,
  canEditProp = () => true,
  depth,
  element,
  showAllProps = false,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  canEditProp?: (prop: ConceptStyleProp) => boolean;
  /** How many slots deep the card or panel itself sits. */
  depth: number;
  element: ReviewConceptElement;
  /** Show all controls for slot children in the brand kit style editor. */
  showAllProps?: boolean;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const dividersId = useId();
  const slots = element.slots ?? {};
  const canEditAnyProp = (...props: ConceptStyleProp[]) =>
    props.some(canEditProp);
  const showSlotProp = (name: ConceptSlotName) => (field: SlotStyleField) =>
    canEditProp(slotStyleProp(name, field));
  if (element.kind === "accordion") {
    return (
      <>
        {canEditProp("accordionExpanded") ? (
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
        ) : null}
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
              showAllProps={showAllProps}
              showSlotProp={showSlotProp(name)}
              slot={slots[name] ?? { elements: [] }}
            />
          );
        })}
      </>
    );
  }
  return (
    <>
      {canEditProp("dividers") ? (
        <ConceptGroup name="Slots">
          <label className="review-concepts__check" htmlFor={dividersId}>
            <Checkbox
              checked={element.dividers ?? element.kind === "buttonGroup"}
              id={dividersId}
              onChange={(event) => onChange({ dividers: event.target.checked })}
            />
            <span>
              {element.kind === "buttonGroup"
                ? "Lines between buttons"
                : "Lines between slots"}
            </span>
          </label>
        </ConceptGroup>
      ) : null}
      {element.kind === "panel" &&
      canEditAnyProp(
        "direction",
        "slideFrom",
        "panelToggleSide",
        "panelCollapsed"
      ) ? (
        <ConceptGroup name="Motion">
          {canEditProp("direction") || canEditProp("slideFrom") ? (
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
          ) : null}
          {canEditProp("panelToggleSide") ? (
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
          ) : null}
          {canEditProp("panelCollapsed") ? (
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
          ) : null}
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
            showAllProps={showAllProps}
            showSlotProp={showSlotProp(name)}
            slot={slots[name] ?? { elements: [] }}
          />
        ))}
    </>
  );
}
