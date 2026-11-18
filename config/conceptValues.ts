import { isConceptPaint } from "./conceptColor.js";

/** Small checks every concept cleaner uses. */

export const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export const isHex = (value: unknown): value is string =>
  typeof value === "string" && isConceptPaint(value);

export const cleanColor = (value: unknown, fallback: string): string => {
  if (value === "transparent") {
    return value;
  }
  return typeof value === "string" && isConceptPaint(value) ? value : fallback;
};

export const bounded = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

/** A line height, as a multiple of the type size. */
export const LINE_HEIGHT = { max: 2.4, min: 1 } as const;
const LINE_HEIGHT_STEP = 0.05;

/**
 * A line height as typed: a multiple (1.4), or, above the largest multiple,
 * pixels (24), turned into the multiple that gives them at this size. So a
 * px value is not cut down to the largest multiple on save.
 */
export const lineHeightFrom = (value: number, fontSize: number): number => {
  const multiple =
    value > LINE_HEIGHT.max && fontSize > 0 ? value / fontSize : value;
  const stepped = Math.round(multiple / LINE_HEIGHT_STEP) * LINE_HEIGHT_STEP;
  return Number(
    Math.min(LINE_HEIGHT.max, Math.max(LINE_HEIGHT.min, stepped)).toFixed(2)
  );
};
