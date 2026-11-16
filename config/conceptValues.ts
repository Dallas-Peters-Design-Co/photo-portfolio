import { CONCEPT_HEX } from "./conceptColor.js";

/** Small checks every concept cleaner uses. */

export const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export const isHex = (value: unknown): value is string =>
  typeof value === "string" && CONCEPT_HEX.test(value);

export const cleanColor = (value: unknown, fallback: string): string => {
  if (value === "transparent") {
    return value;
  }
  return typeof value === "string" && CONCEPT_HEX.test(value)
    ? value
    : fallback;
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
