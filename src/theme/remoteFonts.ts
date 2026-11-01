import {
  adobeFontCss,
  googleFontCss,
  parseFontRef,
} from "../../config/fontRef.js";

/**
 * Loads a brand font (config/fontRef.ts) by adding its stylesheet to the page,
 * once per family (Google) or once per project (Adobe).
 *
 * A stylesheet link rather than the FontFace API because both services hand
 * out CSS, not files, and Adobe's CSS also carries the licence ping it needs.
 */

const added = new Set<string>();

const addStylesheet = (href: string): void => {
  if (added.has(href) || typeof document === "undefined") {
    return;
  }
  added.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.crossOrigin = "anonymous";
  document.head.append(link);
};

/** True when the value was a brand font ref (and is now loading). */
export const loadFontRef = (value: unknown): boolean => {
  const ref = parseFontRef(value);
  if (!ref) {
    return false;
  }
  addStylesheet(
    ref.source === "google"
      ? googleFontCss(ref.family)
      : adobeFontCss(ref.kitId ?? "")
  );
  return true;
};

/**
 * Just enough of a Google family to draw its own name in a picker: the
 * `text=` parameter asks for only those glyphs, a few hundred bytes each.
 */
export const loadFontPreview = (family: string): void => {
  addStylesheet(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&text=${encodeURIComponent(family)}&display=swap`
  );
};

/** The whole Adobe project, for previews in the kit editor. */
export const loadAdobeKit = (kitId: string): void => {
  addStylesheet(adobeFontCss(kitId));
};
