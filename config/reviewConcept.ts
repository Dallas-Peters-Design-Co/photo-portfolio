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

export type ReviewConceptIcon =
  | "arrow-right"
  | "bell"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "heart"
  | "home"
  | "mail"
  | "menu"
  | "plus"
  | "search"
  | "settings"
  | "shopping-bag"
  | "star"
  | "user"
  | "x";

export const REVIEW_CONCEPT_ICONS: ReviewConceptIcon[] = [
  "arrow-right",
  "bell",
  "check",
  "chevron-down",
  "chevron-right",
  "heart",
  "home",
  "mail",
  "menu",
  "plus",
  "search",
  "settings",
  "shopping-bag",
  "star",
  "user",
  "x",
];

export interface ReviewConceptElement {
  background: string;
  /** Cards only: the outline, and how far the card lifts off the page. */
  borderColor?: string;
  checked?: boolean;
  color: string;
  fontFamily: "sans" | "serif" | "mono" | "brand" | "app";
  fontId?: string;
  fontRef?: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  iconName?: ReviewConceptIcon;
  id: string;
  inputType?: "text" | "email" | "search" | "url" | "tel" | "password";
  kind: ReviewConceptElementKind;
  lineHeight: number;
  options?: string[];
  paddingX: number;
  paddingY: number;
  placeholder?: string;
  radius: number;
  shadow?: CardShadow;
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

export type CardShadow = "none" | "soft" | "strong";

/** Two layers each: a tight edge shadow and a wide soft one. */
export const CARD_SHADOWS: Record<CardShadow, string> = {
  none: "none",
  soft: "0 1px 2px rgb(0 0 0 / 0.08), 0 4px 14px rgb(0 0 0 / 0.12)",
  strong: "0 2px 4px rgb(0 0 0 / 0.2), 0 14px 36px rgb(0 0 0 / 0.35)",
};

const cleanCard = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "borderColor" | "shadow"> => ({
  ...(typeof raw.borderColor === "string" && HEX_COLOR.test(raw.borderColor)
    ? { borderColor: raw.borderColor }
    : {}),
  ...(raw.shadow && raw.shadow in CARD_SHADOWS ? { shadow: raw.shadow } : {}),
});

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

const cleanIconName = (value: unknown): ReviewConceptIcon =>
  REVIEW_CONCEPT_ICONS.includes(value as ReviewConceptIcon)
    ? (value as ReviewConceptIcon)
    : "star";

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
  return {
    background: cleanColor(raw.background, "transparent"),
    color: cleanColor(raw.color, "#172033"),
    ...font,
    fontSize: bounded(raw.fontSize, 10, 72, 16),
    fontWeight,
    id: str(raw.id, 64) || newItemId(),
    ...(kind === "icon" ? { iconName: cleanIconName(raw.iconName) } : {}),
    // A card's icon is optional, so an unknown name drops it instead of
    // defaulting to a star.
    ...(kind === "card" &&
    REVIEW_CONCEPT_ICONS.includes(raw.iconName as ReviewConceptIcon)
      ? { iconName: raw.iconName }
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
