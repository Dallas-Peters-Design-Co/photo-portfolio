import { CONCEPT_HEX } from "./conceptColor.js";
import { type ConceptHover, cleanHover, takesHover } from "./conceptHover.js";
import {
  type ConceptIconSvg,
  cleanIconSvg,
  conceptIconName,
} from "./conceptIcon.js";
import { type ConceptShadow, cleanShadow } from "./conceptShadow.js";
import { type ConceptTable, cleanTable } from "./conceptTable.js";
import { type ConceptTabLook, cleanTabLook } from "./conceptTabs.js";
import { isFontRef } from "./fontRef.js";
import { newItemId } from "./proposal.js";

export const MAX_REVIEW_CONCEPTS = 8;

/** A concept's `align` as the CSS `align-items` value it draws with. */
export const ALIGN_ITEMS = {
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
} as const;
const MAX_CONCEPT_ELEMENTS = 64;
const MAX_TITLE = 160;
const FONT_ID = /^[a-z0-9-]{1,64}$/;
const FONT_FAMILIES = ["sans", "serif", "mono", "brand", "app"] as const;
const ELEMENT_KINDS: ReviewConceptElementKind[] = [
  "text",
  "icon",
  "button",
  "input",
  "textarea",
  "select",
  "checkbox",
  "card",
  "label",
  "badge",
  "link",
  "divider",
  "tabs",
  "table",
  "dialog",
  "menu",
  "toast",
  "skeleton",
];
const FONT_WEIGHTS = [400, 500, 600, 700] as const;
const INPUT_TYPES = [
  "text",
  "email",
  "search",
  "url",
  "tel",
  "password",
] as const;

export type ReviewConceptElementKind =
  | "text"
  | "icon"
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "card"
  | "label"
  | "badge"
  | "link"
  | "divider"
  | "tabs"
  | "table"
  | "dialog"
  | "menu"
  | "toast"
  | "skeleton";

/**
 * A Hugeicons export name from the site's icon set (src/cms/icons.ts), the
 * same set the page editor offers, e.g. "FavouriteIcon".
 */
export type ReviewConceptIcon = string;

export interface ReviewConceptElement {
  /**
   * Checkboxes: the checked box's colour (CSS accent-color). Toasts: the
   * action's colour.
   */
  accentColor?: string;
  background: string;
  /** Cards only: the body's type size. The title uses `fontSize`. */
  bodySize?: number;
  /** Badges and cards: the outline colour; "transparent" draws none. */
  borderColor?: string;
  /** Badges and cards: the outline's width in px, 0–8. Default 1. */
  borderWidth?: number;
  checked?: boolean;
  /** Checkboxes: the box's size in px. */
  checkSize?: number;
  color: string;
  fontFamily: "sans" | "serif" | "mono" | "brand" | "app";
  fontId?: string;
  fontRef?: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  /** How it changes under the pointer (see conceptHover.ts). */
  hover?: ConceptHover;
  /** Cards only: the icon's colour and size; default to text colour, 1.5× type. */
  iconColor?: string;
  iconName?: ReviewConceptIcon;
  iconSize?: number;
  /** The drawing of `iconName`, so any library icon renders anywhere. */
  iconSvg?: ConceptIconSvg;
  id: string;
  inputType?: "text" | "email" | "search" | "url" | "tel" | "password";
  kind: ReviewConceptElementKind;
  lineHeight: number;
  options?: string[];
  /**
   * The settings this element has set itself while following a kit style;
   * every other style setting comes from the style (see conceptStyle.ts).
   */
  overrides?: ConceptStyleKey[];
  paddingX: number;
  paddingY: number;
  placeholder?: string;
  radius: number;
  shadow?: ConceptShadow;
  /** The brand kit component style this element follows, if any. */
  styleId?: string;
  /** Tabs only: indicator, active and inactive colours, height. */
  tabLook?: ConceptTabLook;
  /** Tables only: typed columns and rows (see conceptTable.ts). */
  table?: ConceptTable;
  text: string;
  /** Toasts: the action's label ("Undo"); none when empty. */
  toastAction?: string;
  /** Toasts: whether the close button shows. Default true. */
  toastClose?: boolean;
}

/**
 * An element's look, as opposed to its content: what a brand kit component
 * style sets. `tableBorders` and `tableHeader` stand for a table's borders and
 * header colours, which live inside `table`.
 */
export const ELEMENT_STYLE_KEYS = [
  "background",
  "color",
  "fontFamily",
  "fontId",
  "fontRef",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "paddingX",
  "paddingY",
  "radius",
  "borderColor",
  "borderWidth",
  "shadow",
  "bodySize",
  "iconColor",
  "iconSize",
  // A style may set an icon too ("Input / Search"); it is kept or overridden
  // as one choice with its drawing.
  "iconName",
  "iconSvg",
  "accentColor",
  "checkSize",
  "tabLook",
  "hover",
] as const satisfies readonly (keyof ReviewConceptElement)[];

export const CONCEPT_STYLE_KEYS = [
  ...ELEMENT_STYLE_KEYS,
  "tableBorders",
  "tableHeader",
] as const;

export type ConceptStyleKey = (typeof CONCEPT_STYLE_KEYS)[number];

/** A kit style's id, and an element's link to one. */
export const STYLE_ID = /^[a-z0-9-]{1,64}$/i;

const cleanLink = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "overrides" | "styleId"> => {
  if (typeof raw.styleId !== "string" || !STYLE_ID.test(raw.styleId)) {
    return {};
  }
  const overrides = (Array.isArray(raw.overrides) ? raw.overrides : []).filter(
    (key, index, all): key is ConceptStyleKey =>
      CONCEPT_STYLE_KEYS.includes(key as ConceptStyleKey) &&
      all.indexOf(key) === index
  );
  return {
    ...(overrides.length > 0 ? { overrides } : {}),
    styleId: raw.styleId,
  };
};

export interface ReviewConcept {
  align: "start" | "center" | "end" | "stretch";
  background: string;
  color: string;
  direction: "row" | "column";
  elements: ReviewConceptElement[];
  fontFamily: "sans" | "serif" | "mono" | "brand" | "app";
  fontId?: string;
  fontRef?: string;
  gap: number;
  id: string;
  padding: number;
  radius: number;
  title: string;
}

/** A card keeps its title on the first line of `text` and its body below. */
export const splitCardText = (
  text: string
): { body: string; title: string } => {
  const [title = "", ...body] = text.split("\n");
  return { body: body.join("\n"), title };
};

export const joinCardText = (title: string, body: string): string =>
  body ? `${title.replace(/\n/g, " ")}\n${body}` : title.replace(/\n/g, " ");

const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

const isHex = (value: unknown): value is string =>
  typeof value === "string" && CONCEPT_HEX.test(value);

/** Kinds that may carry an icon beside their text; an icon element always has one. */
const OPTIONAL_ICON_KINDS = new Set<ReviewConceptElementKind>([
  "card",
  "input",
]);

export const takesIcon = (kind: ReviewConceptElementKind): boolean =>
  OPTIONAL_ICON_KINDS.has(kind);

/** A card's icon leads at 1.5× its title; an input's sits at text size. */
export const iconSizeOf = (element: ReviewConceptElement): number =>
  element.iconSize ??
  (element.kind === "card"
    ? Math.round(element.fontSize * 1.5)
    : element.fontSize);

const cleanIcon = (
  kind: ReviewConceptElementKind,
  raw: Partial<ReviewConceptElement>
): Pick<
  ReviewConceptElement,
  "iconColor" | "iconName" | "iconSize" | "iconSvg"
> => {
  // An optional icon with an unknown name is dropped, not made a star.
  const iconName =
    conceptIconName(raw.iconName) ?? (kind === "icon" ? "StarIcon" : null);
  if (!(iconName && (kind === "icon" || takesIcon(kind)))) {
    return {};
  }
  const iconSvg = cleanIconSvg(raw.iconSvg);
  return {
    iconName,
    ...(iconSvg ? { iconSvg } : {}),
    ...(takesIcon(kind) && isHex(raw.iconColor)
      ? { iconColor: raw.iconColor }
      : {}),
    ...(takesIcon(kind) && typeof raw.iconSize === "number"
      ? { iconSize: bounded(raw.iconSize, 8, 96, 24) }
      : {}),
  };
};

/**
 * Kinds drawn as a box, with an editable border (colour or none, width) and
 * shadow: the controls, the surfaces and the pills.
 */
const BOX_KINDS = new Set<ReviewConceptElementKind>([
  "badge",
  "button",
  "card",
  "input",
  "select",
  "table",
  "textarea",
]);

export const takesBox = (kind: ReviewConceptElementKind): boolean =>
  BOX_KINDS.has(kind);

const cleanBox = (
  kind: ReviewConceptElementKind,
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "borderColor" | "borderWidth" | "shadow"> => {
  if (!takesBox(kind)) {
    return {};
  }
  const shadow = cleanShadow(raw.shadow);
  return {
    // "transparent" is the editor's None: kept, so it is not a fallback.
    ...(isHex(raw.borderColor) || raw.borderColor === "transparent"
      ? { borderColor: raw.borderColor }
      : {}),
    ...(typeof raw.borderWidth === "number"
      ? { borderWidth: bounded(raw.borderWidth, 0, 8, 1) }
      : {}),
    ...(shadow ? { shadow } : {}),
  };
};

const cleanCheckbox = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "accentColor" | "checkSize"> => ({
  ...(isHex(raw.accentColor) ? { accentColor: raw.accentColor } : {}),
  ...(typeof raw.checkSize === "number"
    ? { checkSize: bounded(raw.checkSize, 10, 40, 18) }
    : {}),
});

const MAX_TOAST_ACTION = 40;

const cleanToast = (
  raw: Partial<ReviewConceptElement>
): Pick<
  ReviewConceptElement,
  "accentColor" | "toastAction" | "toastClose"
> => ({
  ...(isHex(raw.accentColor) ? { accentColor: raw.accentColor } : {}),
  ...(typeof raw.toastAction === "string"
    ? { toastAction: str(raw.toastAction, MAX_TOAST_ACTION) }
    : {}),
  ...(typeof raw.toastClose === "boolean"
    ? { toastClose: raw.toastClose }
    : {}),
});

const cleanCard = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "bodySize"> =>
  typeof raw.bodySize === "number"
    ? { bodySize: bounded(raw.bodySize, 10, 72, 14) }
    : {};

const cleanColor = (value: unknown, fallback: string): string => {
  if (value === "transparent") {
    return value;
  }
  return typeof value === "string" && CONCEPT_HEX.test(value)
    ? value
    : fallback;
};

const bounded = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const fontSelection = (
  familyValue: unknown,
  refValue: unknown,
  idValue: unknown
): Pick<ReviewConceptElement, "fontFamily" | "fontId" | "fontRef"> => {
  const requested = FONT_FAMILIES.includes(
    familyValue as (typeof FONT_FAMILIES)[number]
  )
    ? (familyValue as ReviewConceptElement["fontFamily"])
    : "sans";
  const ref = isFontRef(refValue) ? refValue : null;
  const id =
    typeof idValue === "string" && FONT_ID.test(idValue) ? idValue : null;
  const fontFamily =
    (requested === "brand" && !ref) || (requested === "app" && !id)
      ? "sans"
      : requested;
  return {
    fontFamily,
    ...(fontFamily === "app" && id ? { fontId: id } : {}),
    ...(fontFamily === "brand" && ref ? { fontRef: ref } : {}),
  };
};

const cleanInputType = (value: unknown): ReviewConceptElement["inputType"] =>
  INPUT_TYPES.includes(value as (typeof INPUT_TYPES)[number])
    ? (value as ReviewConceptElement["inputType"])
    : "text";

const cleanKind = (value: unknown): ReviewConceptElementKind =>
  ELEMENT_KINDS.includes(value as ReviewConceptElementKind)
    ? (value as ReviewConceptElementKind)
    : "text";

const cleanOptions = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter((option): option is string => typeof option === "string")
    .slice(0, 8)
    .map((option) => str(option, 100));
};

export const cleanElement = (value: unknown): ReviewConceptElement => {
  const raw = (value ?? {}) as Partial<ReviewConceptElement>;
  const font = fontSelection(raw.fontFamily, raw.fontRef, raw.fontId);
  const fontWeight = FONT_WEIGHTS.includes(
    raw.fontWeight as (typeof FONT_WEIGHTS)[number]
  )
    ? (raw.fontWeight as 400 | 500 | 600 | 700)
    : 400;
  const options = cleanOptions(raw.options);
  const kind = cleanKind(raw.kind);
  const table = kind === "table" ? cleanTable(raw.table) : undefined;
  const tabLook = kind === "tabs" ? cleanTabLook(raw.tabLook) : undefined;
  const hover = takesHover(kind) ? cleanHover(raw.hover) : undefined;
  return {
    background: cleanColor(raw.background, "transparent"),
    color: cleanColor(raw.color, "#172033"),
    ...font,
    fontSize: bounded(raw.fontSize, 10, 72, 16),
    fontWeight,
    id: str(raw.id, 64) || newItemId(),
    ...cleanIcon(kind, raw),
    kind,
    lineHeight: bounded(raw.lineHeight, 1, 2.4, 1.4),
    paddingX: bounded(raw.paddingX, 0, 48, 16),
    paddingY: bounded(raw.paddingY, 0, 32, 10),
    radius: bounded(raw.radius, 0, 48, 4),
    ...(kind === "card" ? cleanCard(raw) : {}),
    ...cleanBox(kind, raw),
    ...(kind === "checkbox" ? cleanCheckbox(raw) : {}),
    ...(kind === "toast" ? cleanToast(raw) : {}),
    ...(tabLook ? { tabLook } : {}),
    ...(hover ? { hover } : {}),
    ...(table ? { table } : {}),
    ...cleanLink(raw),
    text: str(raw.text, 500),
    ...(typeof raw.placeholder === "string"
      ? { placeholder: str(raw.placeholder, 200) }
      : {}),
    ...(options ? { options } : {}),
    inputType: cleanInputType(raw.inputType),
    ...(typeof raw.checked === "boolean" ? { checked: raw.checked } : {}),
  };
};

export const cleanConcept = (value: unknown): ReviewConcept => {
  const raw = (value ?? {}) as Partial<ReviewConcept>;
  const font = fontSelection(raw.fontFamily, raw.fontRef, raw.fontId);
  const alignOptions = ["start", "center", "end", "stretch"] as const;
  const align = alignOptions.includes(
    raw.align as (typeof alignOptions)[number]
  )
    ? (raw.align as (typeof alignOptions)[number])
    : "start";
  return {
    align,
    background: cleanColor(raw.background, "#f2f4f7"),
    color: cleanColor(raw.color, "#172033"),
    direction: raw.direction === "row" ? "row" : "column",
    elements: (Array.isArray(raw.elements) ? raw.elements : [])
      .slice(0, MAX_CONCEPT_ELEMENTS)
      .map(cleanElement),
    ...font,
    gap: bounded(raw.gap, 0, 64, 12),
    id: str(raw.id, 64) || newItemId(),
    padding: bounded(raw.padding, 0, 96, 24),
    radius: bounded(raw.radius, 0, 64, 12),
    title: str(raw.title, MAX_TITLE),
  };
};
