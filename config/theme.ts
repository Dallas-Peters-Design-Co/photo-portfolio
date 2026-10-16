/**
 * The editable presentation layer: fonts and colors an admin can change from
 * the settings panel without a deploy.
 *
 * Kept beside config/sites.ts and dependency-free so the browser, the
 * serverless functions and vite.config.ts can all import it.
 */
/** biome-ignore-all lint/suspicious/noUnnecessaryConditions: reasons */

import { STATIC_FONTS } from "./staticFonts.js";

export type FontId =
  | "geist"
  | "inter"
  | "space-grotesk"
  | "mulish"
  | "plus-jakarta-sans"
  | "figtree"
  | "manrope"
  | "playfair-display"
  | "fraunces"
  | "cormorant-garamond"
  | "oswald"
  | "bebas-neue"
  | "anton"
  | "archivo-black"
  | "archivo-narrow"
  | "big-shoulders-display"
  | "barlow-condensed"
  | "saira-condensed"
  | "saira-extra-condensed"
  | "teko"
  | "antonio"
  | "league-gothic"
  | "fjalla-one"
  | "roboto-condensed"
  | "sofia-sans-condensed"
  | "rajdhani"
  | "syne"
  | "unbounded"
  | "bricolage-grotesque"
  | "chivo"
  | "archivo"
  | "outfit"
  | "red-hat-display"
  | "epilogue"
  | "dm-serif-display"
  | "instrument-serif"
  | "bodoni-moda"
  | "young-serif"
  | "barlow-semi-condensed";

export interface FontChoice {
  /**
   * Where the family belongs in the settings: body sans, body serif, or
   * display — faces made for titles (condensed, poster, display serifs) that
   * would be a poor body text and are only offered for the display slot.
   */
  category: "sans" | "serif" | "display";
  /**
   * The weights a static family ships, lowest first; absent for a variable
   * family, which covers its whole `weight` range. A static family is loaded
   * cut by cut and set with `font-weight`, so anything that offers a weight
   * has to offer one of these.
   */
  cuts?: number[];
  id: FontId;
  /** Whether the family ships an italic. */
  italic: boolean;
  /** Shown in the settings dropdown. */
  label: string;
  /** The value written into --font-sans / --font-serif. */
  stack: string;
  /**
   * The family's variable `wght` axis, copied from its @fontsource metadata.
   *
   * Recorded because a browser silently clamps a weight outside the axis:
   * asking Playfair Display for 300 draws 400. Anything offering a weight
   * picker has to cut the list to this range, or half the options do nothing.
   */
  weight: { max: number; min: number };
}

/**
 * Curated rather than free-text: every entry is self-hosted through
 * @fontsource, so there is no third-party request and no flash of unstyled
 * text, and an admin cannot land on a family that fails to load.
 *
 * Adding a font means adding the package, an entry here, and a line in
 * FONT_LOADERS (src/theme/fonts.ts). That deploy is the deliberate cost of
 * never shipping a broken font.
 */
export const FONT_CHOICES: FontChoice[] = [
  {
    category: "sans",
    id: "figtree",
    italic: true,
    label: "Figtree",
    stack: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    weight: { max: 900, min: 300 },
  },
  {
    category: "sans",
    id: "plus-jakarta-sans",
    italic: true,
    label: "Plus Jakarta Sans",
    stack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    weight: { max: 800, min: 200 },
  },
  {
    category: "sans",
    id: "mulish",
    italic: true,
    label: "Mulish",
    stack: '"Mulish Variable", ui-sans-serif, system-ui, sans-serif',
    weight: { max: 1000, min: 200 },
  },
  {
    category: "sans",
    id: "geist",
    italic: false,
    label: "Geist",
    stack: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    weight: { max: 900, min: 100 },
  },
  {
    category: "sans",
    id: "inter",
    italic: true,
    label: "Inter",
    stack: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
    weight: { max: 900, min: 100 },
  },
  {
    category: "sans",
    id: "space-grotesk",
    italic: false,
    label: "Space Grotesk",
    stack: '"Space Grotesk Variable", ui-sans-serif, system-ui, sans-serif',
    weight: { max: 700, min: 300 },
  },
  {
    category: "sans",
    id: "manrope",
    italic: false,
    label: "Manrope",
    stack: '"Manrope Variable", ui-sans-serif, system-ui, sans-serif',
    weight: { max: 800, min: 200 },
  },
  {
    category: "serif",
    id: "playfair-display",
    italic: true,
    label: "Playfair Display",
    stack: '"Playfair Display Variable", Georgia, serif',
    weight: { max: 900, min: 400 },
  },
  {
    category: "serif",
    id: "fraunces",
    italic: true,
    label: "Fraunces",
    stack: '"Fraunces Variable", Georgia, serif',
    weight: { max: 900, min: 100 },
  },
  {
    category: "serif",
    id: "cormorant-garamond",
    italic: true,
    label: "Cormorant Garamond",
    stack: '"Cormorant Garamond Variable", Georgia, serif',
    weight: { max: 700, min: 300 },
  },
];

FONT_CHOICES.push(...STATIC_FONTS);

export const SANS_FONTS = FONT_CHOICES.filter((f) => f.category === "sans");
export const SERIF_FONTS = FONT_CHOICES.filter((f) => f.category === "serif");
/** Titles may be set in any family, display faces first. */
export const DISPLAY_FONTS = [
  ...FONT_CHOICES.filter((f) => f.category === "display"),
  ...SANS_FONTS,
  ...SERIF_FONTS,
];
/** The static families, by the @fontsource package name (which is the id). */
export const isStaticFont = (font: FontChoice): boolean =>
  Array.isArray(font.cuts);

export const findFont = (id: string | undefined): FontChoice | undefined =>
  FONT_CHOICES.find((f) => f.id === id);

/**
 * Everything an admin may restyle. Deliberately small: these three drive the
 * existing @theme custom properties, so there is no combination that leaves the
 * site unstyled — only ones that leave it ugly, which `contrastRatio` warns about.
 */
export interface SiteTheme {
  /** Hero wordmark and highlights. Replaces the old hard-coded Tailwind class. */
  accent: string;
  background: string;
  /**
   * Titles: the proposal's title and clause headings, and anything else set
   * in display type. Any family, so a condensed sans can head a body set in
   * a wider one. Falls back to the sans when unset.
   */
  displayFont: FontId;
  foreground: string;
  sansFont: FontId;
  serifFont: FontId;
}

export const DEFAULT_THEME: Record<string, SiteTheme> = {
  addison: {
    accent: "#ffffff",
    background: "#000000",
    displayFont: "inter",
    foreground: "#ffffff",
    sansFont: "inter",
    serifFont: "cormorant-garamond",
  },
  cyan: {
    // Matches the text-cyan-200 the wordmark used before theming moved to the DB.
    accent: "#a5f3fc",
    background: "#000000",
    displayFont: "inter",
    foreground: "#ffffff",
    sansFont: "inter",
    serifFont: "cormorant-garamond",
  },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value);

/** sRGB relative luminance, per WCAG. */
const luminance = (hex: string): number => {
  const channel = (n: number): number => {
    const c = n / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(Number.parseInt(hex.slice(1, 3), 16));
  const g = channel(Number.parseInt(hex.slice(3, 5), 16));
  const b = channel(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * WCAG contrast ratio, 1–21. Used to warn in the settings panel before an admin
 * saves white-on-white.
 */
export const contrastRatio = (a: string, b: string): number => {
  if (!(isHexColor(a) && isHexColor(b))) {
    return 0;
  }
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Discards unknown keys and invalid values, falling back to the site default. */
export const normalizeTheme = (
  raw: unknown,
  fallback: SiteTheme
): SiteTheme => {
  const t = (raw ?? {}) as Partial<SiteTheme>;
  const sansFont = findFont(t.sansFont)?.id ?? fallback.sansFont;
  return {
    accent: isHexColor(t.accent) ? t.accent : fallback.accent,
    background: isHexColor(t.background) ? t.background : fallback.background,
    // Themes saved before there was a display font head with their sans.
    displayFont:
      findFont(t.displayFont)?.id ?? fallback.displayFont ?? sansFont,
    foreground: isHexColor(t.foreground) ? t.foreground : fallback.foreground,
    sansFont,
    serifFont: findFont(t.serifFont)?.id ?? fallback.serifFont,
  };
};
