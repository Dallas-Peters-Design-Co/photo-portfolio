import { cleanIcon } from "./conceptKinds.js";
import {
  type ConceptSlot,
  type ConceptSlots,
  hasSlots,
  mapChildren,
  SLOT_NAMES,
  SLOT_STYLE_FIELD_KEYS,
  SLOT_STYLE_FIELDS,
  type SlotStyleProp,
  slotStyleProp,
} from "./conceptSlots.js";

import {
  type ConceptCellLook,
  type ConceptTable,
  type ConceptTableBorders,
  type ConceptTableColumn,
  type ConceptTableHeader,
  cellStyleKinds,
  cleanTable,
  tableOf,
} from "./conceptTable.js";
import { cleanTooltip } from "./conceptTooltip.js";
import { newItemId } from "./proposal.js";
import type { ReviewDoc } from "./review.js";
import {
  CONCEPT_STYLE_KEYS,
  type ConceptStyleKey,
  cleanElement,
  ELEMENT_STYLE_KEYS,
  joinCardText,
  type ReviewConcept,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
  STYLE_ID,
  splitCardText,
} from "./reviewConcept.js";

/**
 * Brand kit component styles: a button, badge, card or table styled once in
 * the kit and followed by every concept element that picks it.
 *
 * Linked, not copied. An element stores the style's id and the settings it
 * has changed itself (`overrides`); everything else is read from the style
 * whenever the element is drawn. The element also keeps its own values, so a
 * deleted style or kit leaves it looking as it last did rather than broken.
 *
 * The server applies the kit's current styles when it sends a review (the
 * public page cannot read kits), and the editor applies them to its preview,
 * so a change to the kit shows everywhere at once.
 */

type ElementStyleKey = (typeof ELEMENT_STYLE_KEYS)[number];

export type ConceptStyleLook = Partial<
  Pick<ReviewConceptElement, ElementStyleKey>
> & {
  /**
   * A panel's or card's starting items (header, body, footer, close), set in
   * the kit. A new element made from the style starts with them; one that
   * already follows the style keeps its own, since they are its content.
   */
  contents?: ConceptSlots;
  groupContents?: ReviewConceptElement["group"];
  tableContents?: Pick<ConceptTable, "columns" | "rows" | "icons">;
  tableBorders?: ConceptTableBorders;
  tableHeader?: ConceptTableHeader;
};

/** A component prop exposed to the instance editors. */
export type ConceptStyleProp =
  | "title"
  | "body"
  | "text"
  | "placeholder"
  | "options"
  | "inputType"
  | "checked"
  | "direction"
  | "progress"
  | "toastAction"
  | "toastClose"
  | "tableContents"
  | "headerText"
  | SlotStyleProp
  | ConceptStyleKey;

export interface ConceptStyle {
  id: string;
  kind: ReviewConceptElementKind;
  look: ConceptStyleLook;
  name: string;
  /** Props an instance may change; slots and their contents remain available. */
  overridableProps?: ConceptStyleProp[];
}

export const MAX_CONCEPT_STYLES = 256;
/** Icon settings a style may leave unset; the element's own then stand. */
const ICON_KEYS = new Set<ConceptStyleKey>([
  "summaryIconName",
  "summaryIconSvg",
  "iconColor",
  "iconEndName",
  "iconEndSvg",
  "iconName",
  "iconSize",
  "iconSvg",
]);
/** Settings every element has: never left blank by a style missing them. */
const REQUIRED_KEYS = new Set<ConceptStyleKey>([
  "background",
  "color",
  "tooltip",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "paddingX",
  "paddingY",
  "radius",
]);
const ICON_CHOICES = [
  new Set<ConceptStyleKey>(["iconName", "iconSvg"]),
  new Set<ConceptStyleKey>(["iconEndName", "iconEndSvg"]),
  new Set<ConceptStyleKey>(["summaryIconName", "summaryIconSvg"]),
];
/** One choice each, kept or overridden whole. */
const LINKED_KEYS = [
  new Set<ConceptStyleKey>(["fontFamily", "fontId", "fontRef"]),
  ...ICON_CHOICES,
];
const MAX_STYLE_NAME = 60;

/** Only content or behaviour that makes sense to vary per instance. */
const ICON_PROPS: readonly ConceptStyleProp[] = [
  "iconName",
  "iconSvg",
  "iconEndName",
  "iconEndSvg",
  "iconSize",
  "iconColor",
];
const BUTTON_PROPS: readonly ConceptStyleProp[] = ["text", ...ICON_PROPS];
const KIND_COMPONENT_PROPS: Record<
  ReviewConceptElementKind,
  readonly ConceptStyleProp[]
> = {
  accordion: [
    "text",
    "accordionExpanded",
    "iconName",
    "iconSvg",
    "iconSize",
    "iconColor",
    "summaryIconName",
    "summaryIconSvg",
  ],
  avatar: ["avatarUrl", "avatarInitials"],
  badge: BUTTON_PROPS,
  button: BUTTON_PROPS,
  buttonGroup: [],
  canvas: [],
  card: [
    "title",
    "body",
    "text",
    "bodySize",
    "titleWeight",
    "fullHeight",
    "dividers",
    "iconName",
    "iconSvg",
    "iconSize",
    "iconColor",
  ],
  checkbox: ["text", "checked", "accentColor", "checkSize"],
  dialog: ["text"],
  divider: [],
  group: [],
  icon: ["iconName", "iconSvg", "iconSize", "iconColor"],
  input: ["text"],
  label: ["text"],
  link: ["text"],
  logo: ["logoUrl", "logoHeight"],
  menu: ["text", "menuLook", "options"],
  navbar: [],
  orderedList: ["text"],
  panel: ["headerText", "direction", "panelToggleSide"],
  progress: ["text", "barHeight", "accentColor", "showValue", "progress"],
  select: ["text"],
  shader: [],
  skeleton: ["text"],
  table: ["tableBorders", "tableHeader", "tableContents"],
  tabs: ["text", "tabLook", "options"],
  tag: BUTTON_PROPS,
  text: ["text"],
  textarea: ["text"],
  toast: ["text", "toastAction", "toastClose"],
  tooltip: ["text"],
  upload: ["text"],
};

const SLOT_NAMES_BY_KIND: Partial<
  Record<
    ReviewConceptElementKind,
    readonly ("header" | "body" | "footer" | "hide")[]
  >
> = {
  accordion: ["header", "body"],
  card: ["header", "body", "footer"],
  navbar: ["header", "body", "footer"],
  panel: ["header", "body", "footer", "hide"],
};

/** Props a custom component of this kind can offer to an instance. */
export const componentPropOptionsForKind = (
  kind: ReviewConceptElementKind
): ConceptStyleProp[] => [
  ...KIND_COMPONENT_PROPS[kind],
  ...(SLOT_NAMES_BY_KIND[kind] ?? []).flatMap((slot) =>
    SLOT_STYLE_FIELDS.map((field) => slotStyleProp(slot, field))
  ),
];

/** Props a kit style may expose on an instance. */
export const componentPropOptionsOf = (
  style: ConceptStyle
): ConceptStyleProp[] => componentPropOptionsForKind(style.kind);

/** Props shown as editable controls on an instance. */
export const componentPropsOf = (style: ConceptStyle): ConceptStyleProp[] =>
  style.overridableProps ?? [];

/** An element's look: the part a style holds. */
export const lookOf = (element: ReviewConceptElement): ConceptStyleLook => {
  const look: Record<string, unknown> = {};
  for (const key of ELEMENT_STYLE_KEYS) {
    if (element[key] !== undefined) {
      look[key] = element[key];
    }
  }
  return {
    ...(look as ConceptStyleLook),
    ...(element.table?.borders ? { tableBorders: element.table.borders } : {}),
    ...(element.table?.header ? { tableHeader: element.table.header } : {}),
  };
};

/**
 * A style, checked the same way an element is: its look goes through
 * cleanElement, so a style can hold nothing an element could not.
 */
const cleanStyle = (value: unknown): ConceptStyle | null => {
  const raw = (value ?? {}) as Partial<ConceptStyle>;
  if (typeof raw.id !== "string" || !STYLE_ID.test(raw.id)) {
    return null;
  }
  const look = (raw.look ?? {}) as ConceptStyleLook;
  const element = cleanElement({
    ...look,
    group: look.groupContents,
    // A stand-in when the style sets no icon, so its icon size and colour
    // survive cleaning (cleanIcon keeps them only beside an icon).
    iconName: look.iconName ?? "StarIcon",
    kind: raw.kind,
    slots: look.contents,
    // A table's borders and header are checked by the table's own rules.
    table: {
      borders: look.tableBorders,
      columns: [{ kind: "text", label: "Sample" }],
      header: look.tableHeader,
      rows: [],
    },
  });
  const table = element.kind === "table" && cleanTable(look.tableContents);
  const tableContents = table
    ? {
        columns: table.columns,
        rows: table.rows,
        ...(table.icons ? { icons: table.icons } : {}),
      }
    : undefined;
  const name =
    typeof raw.name === "string"
      ? raw.name.trim().slice(0, MAX_STYLE_NAME)
      : "";
  const cleaned = lookOf(element);
  // The stand-in is not the style's icon.
  const { iconName: _name, iconSvg: _svg, ...iconless } = cleaned;
  const contents =
    look.contents && hasSlots(element.kind) && element.slots
      ? { contents: element.slots }
      : {};
  const cleanedLook = {
    ...(look.iconName ? cleaned : iconless),
    ...contents,
    ...(look.groupContents && element.group
      ? { groupContents: element.group }
      : {}),
    ...(tableContents ? { tableContents } : {}),
  };
  const props = componentPropOptionsOf({
    id: raw.id,
    kind: element.kind,
    look: cleanedLook,
    name,
  });
  const cleanedProps = Array.isArray(raw.overridableProps)
    ? raw.overridableProps.map((key) =>
        element.kind === "panel" && key === "slideFrom" ? "direction" : key
      )
    : [];
  const overridableProps = cleanedProps.filter(
    (key, index, all): key is ConceptStyleProp =>
      props.includes(key as ConceptStyleProp) && all.indexOf(key) === index
  );
  return {
    id: raw.id,
    kind: element.kind,
    look: cleanedLook,
    name: name || "Untitled",
    overridableProps,
  };
};

export const cleanConceptStyles = (value: unknown): ConceptStyle[] =>
  (Array.isArray(value) ? value : [])
    .map(cleanStyle)
    .filter((style): style is ConceptStyle => style !== null)
    .filter(
      (style, index, all) => all.findIndex((s) => s.id === style.id) === index
    )
    .slice(0, MAX_CONCEPT_STYLES);

const keepsOwnStyleSetting = (
  key: ConceptStyleKey,
  style: ConceptStyle
): boolean =>
  (ICON_KEYS.has(key) || REQUIRED_KEYS.has(key)) &&
  style.look[key] === undefined;

const applyTableStyle = (
  element: ReviewConceptElement,
  style: ConceptStyle,
  own: Set<ConceptStyleKey>,
  overridable: Set<ConceptStyleProp>
): ReviewConceptElement => {
  if (element.kind !== "table") {
    return element;
  }
  const table = tableOf(element);
  const borders =
    own.has("tableBorders") && overridable.has("tableBorders")
      ? table.borders
      : style.look.tableBorders;
  const header =
    own.has("tableHeader") && overridable.has("tableHeader")
      ? table.header
      : style.look.tableHeader;
  const { borders: _b, header: _h, ...rest } = table;
  element.table = {
    ...rest,
    ...(borders ? { borders } : {}),
    ...(header ? { header } : {}),
  };
  return element;
};

/** The element as its style draws it, keeping the settings it set itself. */
export const applyConceptStyle = (
  element: ReviewConceptElement,
  styles: ConceptStyle[]
): ReviewConceptElement => {
  const style = styles.find((s) => s.id === element.styleId);
  if (!style || style.kind !== element.kind) {
    return element;
  }
  const own = new Set(element.overrides);
  const overridable = new Set(componentPropsOf(style));
  // The picker changes the name and drawing together, even when the kit
  // exposes just one of those two fields.
  for (const choice of ICON_CHOICES) {
    if ([...choice].some((key) => overridable.has(key))) {
      for (const key of choice) {
        overridable.add(key);
      }
    }
  }
  const next: Record<string, unknown> = { ...element };
  for (const key of ELEMENT_STYLE_KEYS) {
    const ownProp =
      key === "slideFrom" && overridable.has("direction") ? "direction" : key;
    // A style that sets no icon, or (incomplete) no basic setting, leaves
    // the element's own; its unset border and shadow mean "none".
    if (
      !(
        (own.has(key) && (overridable.has(key) || overridable.has(ownProp))) ||
        keepsOwnStyleSetting(key, style)
      )
    ) {
      next[key] = style.look[key];
    }
  }
  const result = applyTableStyle(
    next as unknown as ReviewConceptElement,
    style,
    own,
    overridable
  );
  // A style's optional settings it does not set mean "none", not "leave".
  for (const key of Object.keys(result) as (keyof ReviewConceptElement)[]) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
};

/** The part of a badge or button style a table cell draws with. */
export const cellLookOf = (look: ConceptStyleLook): ConceptCellLook => ({
  ...cleanIcon("button", look),
  ...(look.accentColor && { accentColor: look.accentColor }),
  ...(look.barHeight !== undefined && { barHeight: look.barHeight }),
  ...(look.showValue !== undefined && { showValue: look.showValue }),
  background: look.background,
  borderColor: look.borderColor,
  borderWidth: look.borderColor ? look.borderWidth : 0,
  color: look.color,
  fontSize: look.fontSize,
  fontWeight: look.fontWeight,
  lineHeight: look.lineHeight,
  paddingX: look.paddingX,
  paddingY: look.paddingY,
  radius: look.radius,
  shadow: look.shadow,
});

/** A column's `styleId` when it was set to its own colour on purpose. */
export const CUSTOM_CELL_STYLE = "custom";

/**
 * The kit style a tag, chip or button column draws with: the one it picked,
 * or — when it picked none — the kit's first style of that kind. A table
 * made by hand, by a starter or by an agent then wears the brand's badges
 * without anyone linking each column. Only an explicit "Custom" opts out.
 */
export const columnStyleOf = (
  column: ConceptTableColumn,
  styles: ConceptStyle[]
): ConceptStyle | undefined => {
  const kinds = cellStyleKinds(column.kind);
  if (column.styleId) {
    return styles.find(
      (s) =>
        s.id === column.styleId &&
        column.styleId !== CUSTOM_CELL_STYLE &&
        kinds.includes(s.kind)
    );
  }
  for (const kind of kinds) {
    const style = styles.find((s) => s.kind === kind);
    if (style) {
      return style;
    }
  }
  return undefined;
};

/**
 * A table's tag, chip and button columns, each given its kit style's current
 * look. A style that is gone leaves the column's last look in place.
 */
export const applyColumnStyles = (
  element: ReviewConceptElement,
  styles: ConceptStyle[]
): ReviewConceptElement => {
  if (!element.table || styles.length === 0) {
    return element;
  }
  const columns = element.table.columns.map((column) => {
    const style = columnStyleOf(column, styles);
    const cells =
      column.cells &&
      Object.fromEntries(
        Object.entries(column.cells).map(([row, cell]) => {
          const linked =
            cell.styleId &&
            columnStyleOf({ ...column, styleId: cell.styleId }, styles);
          return [
            row,
            linked ? { ...cell, look: cellLookOf(linked.look) } : cell,
          ];
        })
      );
    return {
      ...column,
      ...(style && { look: cellLookOf(style.look) }),
      ...(cells && { cells }),
    };
  });
  return { ...element, table: { ...element.table, columns } };
};

const slotWithStyle = (
  name: (typeof SLOT_NAMES)[number],
  current: ConceptSlot | undefined,
  template: ConceptSlot,
  props: Set<ConceptStyleProp>,
  overrides: ReviewConceptElement["slotOverrides"]
): ConceptSlot => {
  const merged: Record<string, unknown> = {
    ...current,
    ...template,
    elements: current?.elements ?? template.elements,
  };
  for (const field of SLOT_STYLE_FIELDS) {
    const key = slotStyleProp(name, field);
    const ownKey = SLOT_STYLE_FIELD_KEYS[field];
    const keepOwn = props.has(key) && overrides?.[name]?.includes(field);
    const source = keepOwn ? current : template;
    if (source?.[ownKey] === undefined) {
      delete merged[ownKey];
    } else {
      merged[ownKey] = source[ownKey];
    }
  }
  if (current) {
    merged.elements = current.elements.map((child, index) => {
      const templateChild = template.elements[index];
      if (
        child.styleId ||
        !templateChild?.styleId ||
        child.kind !== templateChild.kind
      ) {
        return child;
      }
      return { ...child, styleId: templateChild.styleId };
    });
  }
  return merged as unknown as ConceptSlot;
};

const slotsWithStyle = (
  current: ReviewConceptElement["slots"],
  template: ConceptSlots,
  style: ConceptStyle,
  overrides: ReviewConceptElement["slotOverrides"]
): ReviewConceptElement["slots"] => {
  const props = new Set(componentPropsOf(style));
  return Object.fromEntries(
    SLOT_NAMES.flatMap((name) => {
      const templateSlot = template[name];
      const currentSlot = current?.[name];
      if (!templateSlot) {
        return currentSlot ? [[name, currentSlot]] : [];
      }
      return [
        [
          name,
          slotWithStyle(name, currentSlot, templateSlot, props, overrides),
        ],
      ];
    })
  ) as ReviewConceptElement["slots"];
};

const slotOverridesFromChange = (
  element: ReviewConceptElement,
  patch: Partial<ReviewConceptElement>
): ReviewConceptElement["slotOverrides"] => {
  if (!patch.slots) {
    return undefined;
  }
  const nextOverrides = { ...element.slotOverrides };
  let changed = false;
  for (const name of SLOT_NAMES) {
    const next = patch.slots[name];
    if (!next) {
      continue;
    }
    const previous = element.slots?.[name];
    const fields = SLOT_STYLE_FIELDS.filter((field) => {
      const key = SLOT_STYLE_FIELD_KEYS[field];
      return key in next && !same(next[key], previous?.[key]);
    });
    if (fields.length === 0) {
      continue;
    }
    nextOverrides[name] = [
      ...new Set([...(nextOverrides[name] ?? []), ...fields]),
    ];
    changed = true;
  }
  return changed ? nextOverrides : undefined;
};

/**
 * An element as the kit draws it: its own style, then its columns', then
 * each element in its slots.
 */
export const styleElement = (
  element: ReviewConceptElement,
  styles: ConceptStyle[]
): ReviewConceptElement => {
  const componentStyle = styles.find(
    (style) => style.id === element.styleId && style.kind === element.kind
  );
  let styled = applyColumnStyles(applyConceptStyle(element, styles), styles);
  // A composite style supplies the default child styles as well as its own
  // look. Keep the instance's content, but let matching unlinked children
  // follow the child styles chosen in the kit.
  const templateSlots = componentStyle?.look.contents;
  if (componentStyle && templateSlots) {
    styled = {
      ...styled,
      slots: slotsWithStyle(
        styled.slots,
        templateSlots,
        componentStyle,
        styled.slotOverrides
      ),
    };
  }
  const { tooltip } = styled;
  const tooltipStyle =
    tooltip?.styleId &&
    styles.find(
      (style) => style.id === tooltip.styleId && style.kind === "tooltip"
    );
  if (tooltip && tooltipStyle) {
    styled = {
      ...styled,
      tooltip: cleanTooltip({
        ...tooltip,
        look: { ...tooltip.look, ...tooltipStyle.look },
      }),
    };
  }
  return styled.slots || styled.group
    ? mapChildren(styled, (child) => styleElement(child, styles))
    : styled;
};

/** Every element of every concept, as its style draws it. */
export const applyConceptStyles = (
  concepts: ReviewConcept[],
  styles: ConceptStyle[]
): ReviewConcept[] =>
  styles.length === 0
    ? concepts
    : concepts.map((concept) => ({
        ...concept,
        elements: concept.elements.map((element) =>
          styleElement(element, styles)
        ),
        // A sequence's later steps are drawn from the same kit.
        ...(concept.steps
          ? {
              steps: concept.steps.map((step) => ({
                ...step,
                elements: step.elements.map((element) =>
                  styleElement(element, styles)
                ),
              })),
            }
          : {}),
      }));

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * An edit to a linked element, with the style settings it changes added to
 * the element's overrides, so the style stops setting them.
 */
export const withOverrides = (
  element: ReviewConceptElement,
  patch: Partial<ReviewConceptElement>
): Partial<ReviewConceptElement> => {
  if (!element.styleId) {
    return patch;
  }
  const slotOverrides = slotOverridesFromChange(element, patch);
  const changed: ConceptStyleKey[] = ELEMENT_STYLE_KEYS.filter(
    (key) => key in patch && !same(patch[key], element[key])
  );
  // A typeface (three keys) and an icon (name and drawing) are each one
  // choice: an element keeps all of it as its own, or none.
  for (const group of LINKED_KEYS) {
    if (changed.some((key) => group.has(key))) {
      for (const key of group) {
        if (!changed.includes(key)) {
          changed.push(key);
        }
      }
    }
  }
  if (patch.table) {
    if (!same(patch.table.borders, element.table?.borders)) {
      changed.push("tableBorders");
    }
    if (!same(patch.table.header, element.table?.header)) {
      changed.push("tableHeader");
    }
  }
  if (changed.length === 0) {
    return slotOverrides ? { ...patch, slotOverrides } : patch;
  }
  const overrides = CONCEPT_STYLE_KEYS.filter(
    (key) => element.overrides?.includes(key) || changed.includes(key)
  );
  return {
    ...patch,
    overrides,
    ...(slotOverrides ? { slotOverrides } : {}),
  };
};

/** The element and everything in its slots and group, each with a new id. */
const withNewIds = (element: ReviewConceptElement): ReviewConceptElement =>
  mapChildren({ ...element, id: newItemId() }, withNewIds);

/**
 * A new element made from a style: its look, and the starting items the kit
 * set for it, each with its own id so two panels never share one.
 */
export const fromStyle = (
  element: ReviewConceptElement,
  style: ConceptStyle
): ReviewConceptElement => {
  const linked = linkStyle(
    style.kind === "table" && style.look.tableContents
      ? { ...element, table: style.look.tableContents }
      : element,
    style
  );
  const name = style.name.trim();
  const usesPlaceholder =
    style.kind === "input" ||
    style.kind === "select" ||
    style.kind === "textarea";
  const named = name
    ? {
        ...linked,
        ...(usesPlaceholder ? { placeholder: name } : {}),
        text:
          style.kind === "card"
            ? joinCardText(name, splitCardText(linked.text).body)
            : name,
      }
    : linked;
  if (style.kind === "group" && style.look.groupContents) {
    return mapChildren(
      { ...named, group: style.look.groupContents },
      withNewIds
    );
  }
  const { contents } = style.look;
  return contents && hasSlots(style.kind)
    ? mapChildren({ ...named, slots: contents }, withNewIds)
    : named;
};

/** Follows a style from now on: its look, and no settings of its own. */
export const linkStyle = (
  element: ReviewConceptElement,
  style: ConceptStyle | null
): ReviewConceptElement => {
  const {
    overrides: _overrides,
    slotOverrides: _slotOverrides,
    styleId: _styleId,
    ...rest
  } = element;
  return style
    ? applyConceptStyle({ ...rest, styleId: style.id }, [style])
    : rest;
};

/** A review document with every concept, on every screen, styled. */
export const applyReviewStyles = (
  doc: ReviewDoc,
  styles: ConceptStyle[],
  kitId?: string | null
): ReviewDoc =>
  styles.length === 0
    ? doc
    : {
        ...doc,
        concepts: applyConceptStyles(doc.concepts, styles),
        screens: doc.screens.map((screen) => ({
          ...screen,
          ...(screen.pageDesign &&
          screen.pageDesign.kitId !== null &&
          screen.pageDesign.kitId === kitId
            ? {
                pageDesign: {
                  ...screen.pageDesign,
                  concept:
                    applyConceptStyles(
                      [screen.pageDesign.concept],
                      styles
                    )[0] ?? screen.pageDesign.concept,
                },
              }
            : {}),
          pins: screen.pins.map((pin) =>
            pin.concepts
              ? { ...pin, concepts: applyConceptStyles(pin.concepts, styles) }
              : pin
          ),
        })),
      };
