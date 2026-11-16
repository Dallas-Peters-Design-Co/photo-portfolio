import { CONCEPT_HEX } from "./conceptColor.js";
import { type ConceptShadow, cleanShadow } from "./conceptShadow.js";

/**
 * How an element changes under the pointer: fill, text, border colour and
 * shadow. Each is optional — what is not set stays as it is. Tabs use only
 * the text colour, for the tabs that are not the current one.
 */
export interface ConceptHover {
  background?: string;
  borderColor?: string;
  color?: string;
  shadow?: ConceptShadow;
}

/** The kinds a reader would point at: controls, links, cards, pills, tabs. */
const HOVER_KINDS = new Set([
  "badge",
  "button",
  "card",
  "checkbox",
  "input",
  "link",
  "select",
  "tabs",
  "textarea",
]);

export const takesHover = (kind: string): boolean => HOVER_KINDS.has(kind);

const hex = <K extends string>(key: K, value: unknown) =>
  typeof value === "string" && CONCEPT_HEX.test(value)
    ? ({ [key]: value } as Record<K, string>)
    : {};

export const cleanHover = (value: unknown): ConceptHover | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const shadow = cleanShadow(raw.shadow);
  const hover: ConceptHover = {
    ...hex("background", raw.background),
    ...hex("borderColor", raw.borderColor),
    ...hex("color", raw.color),
    ...(shadow ? { shadow } : {}),
  };
  return Object.keys(hover).length > 0 ? hover : undefined;
};
