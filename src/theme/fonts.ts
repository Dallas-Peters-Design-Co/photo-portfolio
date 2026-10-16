import { type FontId, findFont, isStaticFont } from "../../config/theme";

/**
 * Dynamic imports rather than top-level ones: Vite splits each font's CSS into
 * its own chunk, so a visitor downloads only the family the site actually uses
 * instead of all of them.
 */
const VARIABLE_LOADERS: Partial<Record<FontId, () => Promise<unknown>>> = {
  "cormorant-garamond": () =>
    import("@fontsource-variable/cormorant-garamond/index.css"),
  figtree: () => import("@fontsource-variable/figtree/index.css"),
  fraunces: () => import("@fontsource-variable/fraunces/index.css"),
  geist: () => import("@fontsource-variable/geist/index.css"),
  inter: () => import("@fontsource-variable/inter/index.css"),
  manrope: () => import("@fontsource-variable/manrope/index.css"),
  mulish: () => import("@fontsource-variable/mulish/index.css"),
  "playfair-display": () =>
    import("@fontsource-variable/playfair-display/index.css"),
  "plus-jakarta-sans": () =>
    import("@fontsource-variable/plus-jakarta-sans/index.css"),
  "space-grotesk": () => import("@fontsource-variable/space-grotesk/index.css"),
};

/**
 * Every weight stylesheet of every static @fontsource package installed,
 * keyed by path and loaded lazily. A static family's entry in
 * config/theme.ts says which weights it has; this is how they are fetched
 * without a hand-written import per cut.
 */
const STATIC_STYLESHEETS = import.meta.glob<unknown>(
  "/node_modules/@fontsource/*/[0-9][0-9][0-9].css"
);
const STATIC_ITALICS = import.meta.glob<unknown>(
  "/node_modules/@fontsource/*/[0-9][0-9][0-9]-italic.css"
);

const loadStatic = (id: FontId): Promise<unknown> => {
  const font = findFont(id);
  const cuts = font?.cuts ?? [];
  const loads: Promise<unknown>[] = [];
  for (const weight of cuts) {
    loads.push(
      STATIC_STYLESHEETS[`/node_modules/@fontsource/${id}/${weight}.css`]?.() ??
        Promise.resolve()
    );
    if (font?.italic) {
      loads.push(
        STATIC_ITALICS[
          `/node_modules/@fontsource/${id}/${weight}-italic.css`
        ]?.() ?? Promise.resolve()
      );
    }
  }
  return Promise.all(loads);
};

const loaded = new Set<FontId>();

/** Loads a font's stylesheets once per session. Failures are non-fatal. */
export const loadFont = async (id: FontId): Promise<void> => {
  if (loaded.has(id)) {
    return;
  }
  loaded.add(id);
  try {
    const font = findFont(id);
    if (font && isStaticFont(font)) {
      await loadStatic(id);
    } else {
      await VARIABLE_LOADERS[id]?.();
    }
  } catch {
    // The stack in config/theme.ts ends in a system fallback, so a font that
    // fails to load degrades to system UI rather than breaking the page.
    loaded.delete(id);
  }
};
