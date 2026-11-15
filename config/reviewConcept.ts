import { type ConceptShadow, cleanShadow } from "./conceptShadow.js";
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
const HEX_COLOR = /^#[\da-f]{3}(?:[\da-f]{3})?$/i;
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

const ICON_NAME = /^[A-Z][A-Za-z0-9]{0,62}Icon$/;

/** Concepts once used a short list of Lucide names; these are their matches. */
const LEGACY_ICONS: Record<string, string> = {
  "arrow-right": "ArrowRight01Icon",
  bell: "Notification01Icon",
  check: "Tick02Icon",
  "chevron-down": "ArrowDown01Icon",
  "chevron-right": "ArrowRight01Icon",
  heart: "FavouriteIcon",
  home: "Home01Icon",
  mail: "Mail01Icon",
  menu: "Menu01Icon",
  plus: "Add01Icon",
  search: "Search01Icon",
  settings: "Settings01Icon",
  "shopping-bag": "ShoppingBag01Icon",
  star: "StarIcon",
  user: "UserIcon",
  x: "Cancel01Icon",
};

/**
 * An icon's drawing, saved with the element so the public page can draw any
 * of the ~6,000 icons without loading the library: Hugeicons' own format,
 * a list of [tag, attributes].
 */
export type ConceptIconSvg = [string, Record<string, string | number>][];

const SVG_TAGS = new Set(["path", "circle", "rect", "ellipse", "line"]);
const SVG_ATTRS = new Set([
  "clipRule",
  "cx",
  "cy",
  "d",
  "fill",
  "fillRule",
  "height",
  "key",
  "opacity",
  "r",
  "rx",
  "ry",
  "stroke",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeOpacity",
  "strokeWidth",
  "transform",
  "width",
  "x",
  "y",
]);
const MAX_SVG_PARTS = 48;
const MAX_SVG_VALUE = 8000;

/**
 * Keeps only plain shapes and drawing attributes, so a saved icon can never
 * carry a script, a handler or a link: anything else drops the whole icon.
 */
const isDrawingAttr = (key: string, value: unknown): boolean =>
  SVG_ATTRS.has(key) &&
  ((typeof value === "string" && value.length <= MAX_SVG_VALUE) ||
    (typeof value === "number" && Number.isFinite(value)));

/** One [tag, attributes] pair, or null if any part of it is not allowed. */
const cleanSvgPart = (part: unknown): ConceptIconSvg[number] | null => {
  if (!Array.isArray(part) || part.length !== 2) {
    return null;
  }
  const [tag, attrs] = part as [unknown, unknown];
  const shapeOk =
    typeof tag === "string" &&
    SVG_TAGS.has(tag) &&
    Boolean(attrs) &&
    typeof attrs === "object" &&
    !Array.isArray(attrs);
  if (!shapeOk) {
    return null;
  }
  const entries = Object.entries(attrs as object);
  return entries.every(([key, value]) => isDrawingAttr(key, value))
    ? [tag as string, Object.fromEntries(entries)]
    : null;
};

export const cleanIconSvg = (value: unknown): ConceptIconSvg | undefined => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_SVG_PARTS
  ) {
    return undefined;
  }
  const parts = value.map(cleanSvgPart);
  return parts.every((part) => part !== null)
    ? (parts as ConceptIconSvg)
    : undefined;
};

/** The Hugeicons name to draw, reading an old Lucide name as its match. */
export const conceptIconName = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const name = LEGACY_ICONS[value] ?? value;
  return ICON_NAME.test(name) ? name : null;
};

export interface ReviewConceptElement {
  background: string;
  /** Cards only: the body's type size. The title uses `fontSize`. */
  bodySize?: number;
  /** Cards only: the outline, and how far the card lifts off the page. */
  borderColor?: string;
  checked?: boolean;
  color: string;
  fontFamily: "sans" | "serif" | "mono" | "brand" | "app";
  fontId?: string;
  fontRef?: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
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
  paddingX: number;
  paddingY: number;
  placeholder?: string;
  radius: number;
  shadow?: ConceptShadow;
  text: string;
}

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
  typeof value === "string" && HEX_COLOR.test(value);

const cleanCard = (
  raw: Partial<ReviewConceptElement>
): Pick<
  ReviewConceptElement,
  "bodySize" | "borderColor" | "iconColor" | "iconSize" | "shadow"
> => {
  const shadow = cleanShadow(raw.shadow);
  return {
    ...(typeof raw.bodySize === "number"
      ? { bodySize: bounded(raw.bodySize, 10, 72, 14) }
      : {}),
    ...(isHex(raw.borderColor) ? { borderColor: raw.borderColor } : {}),
    ...(isHex(raw.iconColor) ? { iconColor: raw.iconColor } : {}),
    ...(typeof raw.iconSize === "number"
      ? { iconSize: bounded(raw.iconSize, 8, 96, 24) }
      : {}),
    ...(shadow ? { shadow } : {}),
  };
};

const cleanColor = (value: unknown, fallback: string): string => {
  if (value === "transparent") {
    return value;
  }
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
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

const cleanElement = (value: unknown): ReviewConceptElement => {
  const raw = (value ?? {}) as Partial<ReviewConceptElement>;
  const font = fontSelection(raw.fontFamily, raw.fontRef, raw.fontId);
  const fontWeight = FONT_WEIGHTS.includes(
    raw.fontWeight as (typeof FONT_WEIGHTS)[number]
  )
    ? (raw.fontWeight as 400 | 500 | 600 | 700)
    : 400;
  const options = cleanOptions(raw.options);
  const kind = cleanKind(raw.kind);
  const iconName = conceptIconName(raw.iconName);
  const iconSvg = cleanIconSvg(raw.iconSvg);
  return {
    background: cleanColor(raw.background, "transparent"),
    color: cleanColor(raw.color, "#172033"),
    ...font,
    fontSize: bounded(raw.fontSize, 10, 72, 16),
    fontWeight,
    id: str(raw.id, 64) || newItemId(),
    ...(kind === "icon" ? { iconName: iconName ?? "StarIcon" } : {}),
    // A card's icon is optional, so an unknown name drops it instead of
    // defaulting to a star.
    ...(kind === "card" && iconName ? { iconName } : {}),
    ...((kind === "icon" || kind === "card") && iconName && iconSvg
      ? { iconSvg }
      : {}),
    kind,
    lineHeight: bounded(raw.lineHeight, 1, 2.4, 1.4),
    paddingX: bounded(raw.paddingX, 0, 48, 16),
    paddingY: bounded(raw.paddingY, 0, 32, 10),
    radius: bounded(raw.radius, 0, 48, 4),
    ...(kind === "card" ? cleanCard(raw) : {}),
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
