import {
  adobeFontCss,
  type FontRef,
  fontshareFontCss,
  fontshareFontPreviewCss,
  googleFontCss,
  parseFontRef,
} from "../../config/fontRef.js";
import type { FontId } from "../../config/theme.js";
import { loadFontStylesheet } from "./fontStylesheets";
import { loadFont } from "./fonts";

/**
 * Loads a brand font (config/fontRef.ts) by adding its stylesheet to the page,
 * once per family (Google or Fontshare) or once per project (Adobe).
 *
 * A stylesheet link rather than the FontFace API because both services hand
 * out CSS, not files, and Adobe's CSS also carries the licence ping it needs.
 */

const stylesheetOf = (ref: FontRef): string => {
  if (ref.source === "google") {
    return googleFontCss(ref.family);
  }
  if (ref.source === "fontshare") {
    return fontshareFontCss(ref.slug ?? "");
  }
  return adobeFontCss(ref.kitId ?? "");
};

/** True when the value was a brand font ref (and is now loading). */
export const loadFontRef = (value: unknown): boolean => {
  const ref = parseFontRef(value);
  if (!ref) {
    return false;
  }
  if (ref.source === "app") {
    void loadFont(ref.fontId as FontId);
    return true;
  }
  void loadFontStylesheet(stylesheetOf(ref), ref.source !== "fontshare");
  return true;
};

/** Waits for the full family stylesheet, rather than a name-only preview. */
export const loadFontRefReady = (value: unknown): Promise<boolean> => {
  const ref = parseFontRef(value);
  if (ref?.source === "app") {
    return loadFont(ref.fontId as FontId).then(() => true);
  }
  return ref
    ? loadFontStylesheet(stylesheetOf(ref), ref.source !== "fontshare")
    : Promise.resolve(false);
};

/**
 * Just enough of a Google family to draw its own name in a picker: the
 * `text=` parameter asks for only those glyphs, a few hundred bytes each.
 */
export const loadFontPreview = (family: string): void => {
  void loadFontStylesheet(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&text=${encodeURIComponent(family)}&display=swap`
  );
};

/** A single regular weight for the font names in search results. */
export const loadFontsharePreview = (slug: string, weight = 400): void => {
  void loadFontStylesheet(fontshareFontPreviewCss(slug, weight), false);
};

/** The whole Adobe project, for previews in the kit editor. */
export const loadAdobeKit = (kitId: string): void => {
  void loadFontStylesheet(adobeFontCss(kitId));
};
