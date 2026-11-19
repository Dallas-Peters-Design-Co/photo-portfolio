import { isConceptPaint } from "./conceptColor.js";
import { type ConceptHover, cleanHover } from "./conceptHover.js";

/** A component's appearance while keyboard focus is within it. */
export interface ConceptFocus extends ConceptHover {
  ringColor?: string;
  ringWidth?: number;
}

const FOCUS_KINDS = new Set([
  "button",
  "checkbox",
  "input",
  "link",
  "select",
  "textarea",
]);

export const takesFocus = (kind: string): boolean => FOCUS_KINDS.has(kind);

export const cleanFocus = (value: unknown): ConceptFocus | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const look = cleanHover(raw);
  const ringColor =
    typeof raw.ringColor === "string" && isConceptPaint(raw.ringColor)
      ? raw.ringColor
      : undefined;
  const ringWidth =
    typeof raw.ringWidth === "number" && Number.isFinite(raw.ringWidth)
      ? Math.min(8, Math.max(0, raw.ringWidth))
      : undefined;
  const focus = {
    ...look,
    ...(ringColor ? { ringColor } : {}),
    ...(ringWidth === undefined ? {} : { ringWidth }),
  };
  return Object.keys(focus).length > 0 ? focus : undefined;
};
