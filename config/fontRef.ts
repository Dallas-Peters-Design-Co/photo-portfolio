/**
 * Fonts from outside the app: any Google Fonts family, or a family from an
 * Adobe Fonts web project.
 *
 * The self-hosted families in config/theme.ts stay the site's own type. These
 * are for brands: a kit names its fonts, and text on a board can be set in
 * them. A text style stores a *font ref*, a short string that says where the
 * family comes from, so a published board can load it with no lookup:
 *
 *   g:Playfair Display        a Google Fonts family
 *   a:abc1234:proxima-nova    an Adobe Fonts family (web project id, CSS name)
 *
 * Shared by the API (to validate what is stored) and the client (to load and
 * render it).
 */

export type FontSource = "adobe" | "google";

export interface FontRef {
  /** The CSS font-family name. */
  family: string;
  /** Adobe Fonts web project id; only for adobe. */
  kitId: string | null;
  source: FontSource;
}

const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,63}$/;
const KIT_ID = /^[a-z0-9]{5,16}$/;

export const isAdobeKitId = (value: unknown): value is string =>
  typeof value === "string" && KIT_ID.test(value);

export const isFontFamilyName = (value: unknown): value is string =>
  typeof value === "string" && FAMILY.test(value);

export const fontRefId = (ref: FontRef): string =>
  ref.source === "google" ? `g:${ref.family}` : `a:${ref.kitId}:${ref.family}`;

/** Reads a ref back, or null when the string is not one. */
export const parseFontRef = (value: unknown): FontRef | null => {
  if (typeof value !== "string") {
    return null;
  }
  if (value.startsWith("g:")) {
    const family = value.slice(2);
    return isFontFamilyName(family)
      ? { family, kitId: null, source: "google" }
      : null;
  }
  if (value.startsWith("a:")) {
    const [, kitId, family] = value.split(":");
    return isAdobeKitId(kitId) && isFontFamilyName(family)
      ? { family, kitId, source: "adobe" }
      : null;
  }
  return null;
};

export const isFontRef = (value: unknown): value is string =>
  parseFontRef(value) !== null;

/** The CSS stack for a ref. */
export const fontRefStack = (ref: FontRef): string =>
  `"${ref.family}", ui-sans-serif, system-ui, sans-serif`;

const ALL_CUTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
  .flatMap((w) => [`${w}`, `${w}i`])
  .join(",");

/**
 * The stylesheet that serves a Google family in every weight and italic it has.
 *
 * The v1 css endpoint rather than css2 on purpose: css2 refuses a weight the
 * family lacks, so one URL could not serve both a variable family and a
 * single-weight display face. v1 quietly returns the cuts that exist, which
 * is what lets a stored ref be just a family name.
 */
export const googleFontCss = (family: string): string =>
  `https://fonts.googleapis.com/css?family=${encodeURIComponent(family).replace(/%20/g, "+")}:${ALL_CUTS}&display=swap`;

/** The stylesheet for an Adobe Fonts web project. */
export const adobeFontCss = (kitId: string): string =>
  `https://use.typekit.net/${kitId}.css`;

/** One family in the Google Fonts catalog, trimmed to what a picker needs. */
export interface CatalogFont {
  /** serif | sans | display | handwriting | mono */
  category: string;
  family: string;
  /** Has an italic. */
  italic: boolean;
  /** Popularity rank, lower is more popular. */
  rank: number;
  /** True when the family has a variable weight axis. */
  variable: boolean;
  weights: number[];
}

/** A family in an Adobe Fonts web project. */
export interface AdobeFamily {
  /** The CSS name to set it with. */
  family: string;
  /** What Adobe calls it. */
  label: string;
  weights: number[];
}
