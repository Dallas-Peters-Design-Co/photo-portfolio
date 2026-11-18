import { CONCEPT_HEX } from "./conceptColor.js";
/**
 * A tabs element's look: the indicator under the active tab, the active and
 * inactive tab colours, and the row's height. Each is optional; without it
 * the tabs draw as before (text colour, a 2px line, the inactive ones
 * softer, height from the padding).
 */
export interface ConceptTabLook {
  activeColor?: string;
  /** The row's height in px. */
  height?: number;
  inactiveColor?: string;
  indicatorColor?: string;
  /** The indicator's thickness in px. */
  indicatorSize?: number;
  /** Space at the row's two ends, before the first tab and after the last. */
  rowPaddingX?: number;
}

export const TAB_LIMITS = {
  height: [20, 96],
  indicatorSize: [1, 8],
  rowPaddingX: [0, Number.POSITIVE_INFINITY],
} as const;

const hex = <K extends string>(key: K, value: unknown) =>
  typeof value === "string" && CONCEPT_HEX.test(value)
    ? ({ [key]: value } as Record<K, string>)
    : {};

const size = <K extends keyof typeof TAB_LIMITS>(key: K, value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {};
  }
  const [min, max] = TAB_LIMITS[key];
  return { [key]: Math.min(max, Math.max(min, Math.round(value))) } as Record<
    K,
    number
  >;
};

export const cleanTabLook = (value: unknown): ConceptTabLook | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const look: ConceptTabLook = {
    ...hex("activeColor", raw.activeColor),
    ...size("height", raw.height),
    ...hex("inactiveColor", raw.inactiveColor),
    ...hex("indicatorColor", raw.indicatorColor),
    ...size("indicatorSize", raw.indicatorSize),
    ...size("rowPaddingX", raw.rowPaddingX),
  };
  return Object.keys(look).length > 0 ? look : undefined;
};
