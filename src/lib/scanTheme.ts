import {
  HEX,
  type LogoEntry,
  MAX_LOGOS,
  MAX_PALETTE,
  type PaletteEntry,
} from "../../config/brandKit.js";

/**
 * What a site scan found for the kit's palette and logos
 * (scripts/scanBrand.mjs), and how it joins what the kit already has:
 * added, never replacing, and never twice.
 */

export interface ScannedColor {
  /** The CSS variable it came from, "--brand-primary" or "--token-6f08…". */
  name: string;
  /** text, background, border, accent: what the page uses it for most. */
  role: string;
  uses: number;
  value: string;
}

export type ScannedLogo =
  | { alt: string; kind: "img"; src: string }
  | { alt: string; kind: "svg"; svg: string };

const ROLE_NAMES: Record<string, string> = {
  accent: "Accent",
  background: "Background",
  border: "Border",
  text: "Text",
};

/** A name a builder made up (a Framer token's id, a hash): no use as a name. */
const MADE_UP = /^(token|var|c|color)?-?[0-9a-f]{6,}|[0-9a-f]{8}-[0-9a-f]{4}/i;
const NAME_PREFIX = /^(color|colour|clr|c)-/;
const DASHES = /^--/;
const SEPARATORS = /[-_]+/g;
const WWW = /^www\./;

/** "--color-brand-primary" → "Brand primary"; null for a made-up name. */
export const nameOfVariable = (variable: string): string | null => {
  const bare = variable.replace(DASHES, "").replace(NAME_PREFIX, "");
  if (!bare || MADE_UP.test(bare) || bare.startsWith("token-")) {
    return null;
  }
  const words = bare.replace(SEPARATORS, " ").trim();
  return words ? words[0]?.toUpperCase() + words.slice(1) : null;
};

/**
 * The scanned colours as palette entries joined onto the kit's: ones it
 * already has (by value) skipped, the rest added in order of use up to the
 * palette's size. A colour without a readable variable name is named for
 * what the site uses it for: "Text", "Background 2".
 */
export const paletteWithScan = (
  palette: PaletteEntry[],
  scanned: ScannedColor[]
): PaletteEntry[] => {
  const have = new Set(palette.map((p) => p.value.toLowerCase()));
  const counts = new Map<string, number>();
  const added: PaletteEntry[] = [];
  for (const c of scanned) {
    const value = c.value.toLowerCase();
    if (!HEX.test(value) || have.has(value)) {
      continue;
    }
    have.add(value);
    const role = ROLE_NAMES[c.role] ? c.role : "accent";
    const n = (counts.get(role) ?? 0) + 1;
    counts.set(role, n);
    const fallback = `${ROLE_NAMES[role]}${n > 1 ? ` ${n}` : ""}`;
    added.push({
      name: nameOfVariable(c.name) ?? fallback,
      role,
      value,
    });
  }
  return [...palette, ...added].slice(0, MAX_PALETTE);
};

/** The label a scanned logo gets, so a rescan finds it rather than adding it again. */
export const scannedLogoLabel = (siteUrl: string): string => {
  try {
    return `${new URL(siteUrl).hostname.replace(WWW, "")} logo`;
  } catch {
    return "Site logo";
  }
};

/** The kit's logos with the scanned one added, or as they were if it's there. */
export const logosWithScan = (
  logos: LogoEntry[],
  label: string,
  url: string
): LogoEntry[] =>
  logos.some((l) => l.label === label)
    ? logos
    : [
        ...logos,
        { clearSpace: 0.5, label, minWidth: 24, rules: "", url },
      ].slice(0, MAX_LOGOS);
