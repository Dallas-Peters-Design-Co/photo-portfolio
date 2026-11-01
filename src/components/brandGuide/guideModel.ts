import type {
  BrandKitDoc,
  PaletteEntry,
  TypefaceEntry,
} from "../../../config/brandKit.js";
import { formatOklch, hexToOklch } from "../../lib/oklch";

/**
 * What the brand guide shows for a kit, worked out from the kit: colours
 * sorted into brand, neutral and signal groups by their role, each colour's
 * values in every format a designer asks for, and which ink reads on it.
 */

export type ColourGroup = "brand" | "neutral" | "signal";

const NEUTRAL =
  /neutral|grey|gray|surface|background|bg|paper|ink|text|base|border|line|mist|stone|snow/i;
const SIGNAL =
  /signal|success|warning|error|danger|alert|info|positive|negative|status/i;

export const groupOf = (entry: PaletteEntry): ColourGroup => {
  const words = `${entry.role} ${entry.name}`;
  if (SIGNAL.test(words)) {
    return "signal";
  }
  if (NEUTRAL.test(words)) {
    return "neutral";
  }
  // Untagged, but nearly colourless: a neutral whatever it's called.
  const c = hexToOklch(entry.value)?.c ?? 0;
  return c < 0.03 ? "neutral" : "brand";
};

export const groupPalette = (
  palette: PaletteEntry[]
): Record<ColourGroup, PaletteEntry[]> => {
  const groups: Record<ColourGroup, PaletteEntry[]> = {
    brand: [],
    neutral: [],
    signal: [],
  };
  for (const entry of palette) {
    groups[groupOf(entry)].push(entry);
  }
  // Neutrals read light to dark, as a scale.
  groups.neutral.sort(
    (a, b) => (hexToOklch(b.value)?.l ?? 0) - (hexToOklch(a.value)?.l ?? 0)
  );
  return groups;
};

export interface ColourValues {
  hex: string;
  oklch: string;
  rgb: string;
}

export const valuesOf = (hex: string): ColourValues => {
  const h = hex.replace("#", "").slice(0, 6);
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16);
  const oklch = hexToOklch(hex);
  return {
    hex: `#${h.toUpperCase()}`,
    oklch: oklch ? formatOklch(oklch) : "",
    rgb: `${n(0)}, ${n(2)}, ${n(4)}`,
  };
};

/** Dark ink on light colours, light on dark, decided in OKLCH lightness. */
export const inkOn = (hex: string): "dark" | "light" =>
  (hexToOklch(hex)?.l ?? 0) > 0.68 ? "dark" : "light";

const HEAD_ROLE = /head|display|title/i;
const BODY_ROLE = /body|text|copy|paragraph/i;

/**
 * Which of a kit's loadable fonts is for headlines and which for body copy,
 * by the role written on each. Without roles, the first is the headline face
 * and the next one the body face.
 */
export const brandFaces = (
  doc: Pick<BrandKitDoc, "typefaces"> | null | undefined
): { body: TypefaceEntry | null; headline: TypefaceEntry | null } => {
  const faces = (doc?.typefaces ?? []).filter((f) => f.ref);
  const byRoleHead = faces.find((f) => HEAD_ROLE.test(f.role));
  const byRoleBody = faces.find((f) => BODY_ROLE.test(f.role));
  const headline = byRoleHead ?? faces.find((f) => f !== byRoleBody) ?? null;
  const body =
    byRoleBody ?? faces.find((f) => f !== headline) ?? headline ?? null;
  return { body, headline };
};
