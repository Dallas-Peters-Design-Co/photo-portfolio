import type { BrandKitDoc, PaletteEntry, TypefaceEntry } from "./brandKit.js";
import type { ConceptStyle } from "./conceptStyle.js";
import {
  paletteIds,
  paletteToken,
  parsePaletteToken,
} from "./paletteBinding.js";

/**
 * One brand's component styles followed by another, live.
 *
 * A kit can name another kit as where its components come from
 * (`componentsFrom`). While it has no styles of its own, it uses that kit's,
 * drawn in its own colours and type: each colour the source's palette names
 * becomes the colour in the same role here (else the same place), and each
 * brand typeface the same. A change to the source's styles shows here next
 * time the kits are read. "Make them this brand's" copies them in, and the
 * link stops mattering.
 *
 * Styles keep their ids, so a review that picked one keeps following it.
 */

const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

/** The entry in `to` that stands where `index` stands in `from`. */
const counterpart = <T extends { role: string }>(
  from: T[],
  to: T[],
  index: number
): T | undefined => {
  const role = from[index]?.role;
  const byRole = role ? to.find((entry) => entry.role === role) : undefined;
  return byRole ?? to[index];
};

const colourMap = (from: PaletteEntry[], to: PaletteEntry[]) => {
  const map = new Map<string, string>();
  const sourceIds = paletteIds(from);
  const targetIds = paletteIds(to);
  from.forEach((entry, i) => {
    const there =
      to[targetIds.indexOf(sourceIds[i])] ?? counterpart(from, to, i);
    if (!there) {
      return;
    }
    if (!map.has(entry.value)) {
      map.set(entry.value, there.value);
    }
    map.set(
      sourceIds[i],
      paletteToken(targetIds[to.indexOf(there)], there.value)
    );
  });
  return map;
};

const faceMap = (from: TypefaceEntry[], to: TypefaceEntry[]) => {
  const map = new Map<string, string>();
  from.forEach((entry, i) => {
    const there = counterpart(from, to, i);
    if (entry.ref && there?.ref && !map.has(entry.ref)) {
      map.set(entry.ref, there.ref);
    }
  });
  return map;
};

/** Every colour and brand face in a value, carried across. */
const carry = (
  value: unknown,
  colours: Map<string, string>,
  faces: Map<string, string>
): unknown => {
  if (typeof value === "string") {
    const binding = parsePaletteToken(value);
    if (binding) {
      return colours.get(binding[1]) ?? value;
    }
    const hex = HEX.exec(value);
    const to = hex ? colours.get(`#${hex[1]?.toLowerCase()}`) : undefined;
    return to ? `${to}${hex?.[2] ?? ""}` : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => carry(v, colours, faces));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] =
      key === "fontRef" && typeof v === "string"
        ? (faces.get(v) ?? v)
        : carry(v, colours, faces);
  }
  return out;
};

/** The source's styles as this brand would draw them. */
export const carryStyles = (
  styles: ConceptStyle[],
  from: BrandKitDoc,
  to: BrandKitDoc
): ConceptStyle[] => {
  const colours = colourMap(from.palette, to.palette);
  const faces = faceMap(from.typefaces, to.typefaces);
  return styles.map((style) => ({
    ...style,
    look: carry(style.look, colours, faces) as ConceptStyle["look"],
  }));
};

/**
 * A resolved kit with the linked kit's styles in, when it follows one;
 * else as it was. `source` is the linked kit's resolved document.
 */
export const withLinkedComponents = (
  own: BrandKitDoc,
  resolved: BrandKitDoc,
  source: BrandKitDoc | null
): BrandKitDoc =>
  source && resolved.componentsFrom && own.componentStyles.length === 0
    ? {
        ...resolved,
        componentStyles: carryStyles(source.componentStyles, source, resolved),
      }
    : resolved;

/**
 * A resolved kit with the linked kit's palette in, when it follows one and
 * has no colours of its own; else as it was. A change to the source's colours
 * shows here next time the kits are read; "Make them this brand's" copies them
 * in. Applied before the component link, so linked styles carry into these.
 */
export const withLinkedPalette = (
  own: BrandKitDoc,
  resolved: BrandKitDoc,
  source: BrandKitDoc | null
): BrandKitDoc =>
  source && resolved.paletteFrom && own.palette.length === 0
    ? { ...resolved, palette: source.palette }
    : resolved;
