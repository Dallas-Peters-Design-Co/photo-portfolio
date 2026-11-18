import { isConceptPaint } from "./conceptColor.js";
import type { ReviewConceptElementKind } from "./reviewConcept.js";

/**
 * The open list of a select or dropdown menu: its fill, text, edge and
 * corners, and the row under the pointer. Each is optional; without it the
 * list follows the element itself (its fill, text, border and corners), and
 * the highlighted row is a soft tint of the text colour.
 */
export interface ConceptMenuLook {
  background?: string;
  borderColor?: string;
  color?: string;
  /** The highlighted row's fill. */
  highlight?: string;
  /** The highlighted row's text. */
  highlightColor?: string;
  /** The list's corners in px. */
  radius?: number;
}

export const MENU_LIMITS = { radius: [0, 32] } as const;

const MENU_KINDS = new Set<ReviewConceptElementKind>(["menu", "select"]);

/** The kinds that open a list: a select and a dropdown menu. */
export const takesMenu = (kind: ReviewConceptElementKind): boolean =>
  MENU_KINDS.has(kind);

const hex = <K extends string>(key: K, value: unknown) =>
  typeof value === "string" && isConceptPaint(value)
    ? ({ [key]: value } as Record<K, string>)
    : {};

export const cleanMenuLook = (value: unknown): ConceptMenuLook | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const [min, max] = MENU_LIMITS.radius;
  const look: ConceptMenuLook = {
    ...hex("background", raw.background),
    ...hex("borderColor", raw.borderColor),
    ...hex("color", raw.color),
    ...hex("highlight", raw.highlight),
    ...hex("highlightColor", raw.highlightColor),
    ...(typeof raw.radius === "number" && Number.isFinite(raw.radius)
      ? { radius: Math.min(max, Math.max(min, Math.round(raw.radius))) }
      : {}),
  };
  return Object.keys(look).length > 0 ? look : undefined;
};
