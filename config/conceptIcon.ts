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

/** The Hugeicons name to draw, reading an old Lucide name as its match. */
export const conceptIconName = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const name = LEGACY_ICONS[value] ?? value;
  return ICON_NAME.test(name) ? name : null;
};
