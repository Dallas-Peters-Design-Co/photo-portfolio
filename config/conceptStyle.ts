import { type ConceptSlots, hasSlots, mapChildren } from "./conceptSlots.js";
import {
  CELL_STYLE_KIND,
  type ConceptCellLook,
  type ConceptTableBorders,
  type ConceptTableColumn,
  type ConceptTableHeader,
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
  type ReviewConcept,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
  STYLE_ID,
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
  tableBorders?: ConceptTableBorders;
  tableHeader?: ConceptTableHeader;
};

export interface ConceptStyle {
  id: string;
  kind: ReviewConceptElementKind;
  look: ConceptStyleLook;
  name: string;
}

export const MAX_CONCEPT_STYLES = 40;
/** Icon settings a style may leave unset; the element's own then stand. */
const ICON_KEYS = new Set<ConceptStyleKey>([
  "iconColor",
  "iconName",
  "iconSize",
  "iconSvg",
]);
/** Settings every element has: never left blank by a style missing them. */
const REQUIRED_KEYS = new Set<ConceptStyleKey>([
  "background",
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "paddingX",
  "paddingY",
  "radius",
]);
/** One choice each, kept or overridden whole. */
const LINKED_KEYS: readonly ReadonlySet<ConceptStyleKey>[] = [
  new Set<ConceptStyleKey>(["fontFamily", "fontId", "fontRef"]),
  new Set<ConceptStyleKey>(["iconName", "iconSvg"]),
];
const MAX_STYLE_NAME = 60;

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
  return {
    id: raw.id,
    kind: element.kind,
    look: { ...(look.iconName ? cleaned : iconless), ...contents },
    name: name || "Untitled",
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
  const next: Record<string, unknown> = { ...element };
  for (const key of ELEMENT_STYLE_KEYS) {
    // A style that sets no icon, or (incomplete) no basic setting, leaves
    // the element's own; its unset border and shadow mean "none".
    const keepsOwn =
      (ICON_KEYS.has(key) || REQUIRED_KEYS.has(key)) &&
      style.look[key] === undefined;
    if (!(own.has(key) || keepsOwn)) {
      next[key] = style.look[key];
    }
  }
  const result = next as unknown as ReviewConceptElement;
  if (result.kind === "table") {
    // tableOf, so an older table (columns only in `options`) is styled too.
    const table = tableOf(result);
    const borders = own.has("tableBorders")
      ? table.borders
      : style.look.tableBorders;
    const header = own.has("tableHeader")
      ? table.header
      : style.look.tableHeader;
    const { borders: _b, header: _h, ...rest } = table;
    result.table = {
      ...rest,
      ...(borders ? { borders } : {}),
      ...(header ? { header } : {}),
    };
  }
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
  const kind = CELL_STYLE_KIND[column.kind];
  if (!kind || column.styleId === CUSTOM_CELL_STYLE) {
    return undefined;
  }
  const ofKind = styles.filter((s) => s.kind === kind);
  return column.styleId
    ? ofKind.find((s) => s.id === column.styleId)
    : ofKind[0];
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
    return style ? { ...column, look: cellLookOf(style.look) } : column;
  });
  return { ...element, table: { ...element.table, columns } };
};

/**
 * An element as the kit draws it: its own style, then its columns', then
 * each element in its slots.
 */
export const styleElement = (
  element: ReviewConceptElement,
  styles: ConceptStyle[]
): ReviewConceptElement => {
  let styled = applyColumnStyles(applyConceptStyle(element, styles), styles);
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
    return patch;
  }
  const overrides = CONCEPT_STYLE_KEYS.filter(
    (key) => element.overrides?.includes(key) || changed.includes(key)
  );
  return { ...patch, overrides };
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
  const linked = linkStyle(element, style);
  const { contents } = style.look;
  return contents && hasSlots(style.kind)
    ? mapChildren({ ...linked, slots: contents }, withNewIds)
    : linked;
};

/** Follows a style from now on: its look, and no settings of its own. */
export const linkStyle = (
  element: ReviewConceptElement,
  style: ConceptStyle | null
): ReviewConceptElement => {
  const { overrides: _overrides, styleId: _styleId, ...rest } = element;
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
