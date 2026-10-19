import { type FontId, findFont, isStaticFont } from "../../config/theme";

/**
 * Dynamic imports rather than top-level ones: Vite splits each font's CSS into
 * its own chunk, so a visitor downloads only the family the site actually uses
 * instead of all of them.
 */
const VARIABLE_LOADERS: Partial<Record<FontId, () => Promise<unknown>>> = {
  "cormorant-garamond": () =>
    import("@fontsource-variable/cormorant-garamond/index.css"),
  "crimson-pro": () =>
    Promise.all([
      import("@fontsource-variable/crimson-pro/index.css"),
      import("@fontsource-variable/crimson-pro/wght-italic.css"),
    ]),
  "dm-sans": () =>
    Promise.all([
      import("@fontsource-variable/dm-sans/index.css"),
      import("@fontsource-variable/dm-sans/wght-italic.css"),
    ]),
  "eb-garamond": () =>
    Promise.all([
      import("@fontsource-variable/eb-garamond/index.css"),
      import("@fontsource-variable/eb-garamond/wght-italic.css"),
    ]),
  figtree: () => import("@fontsource-variable/figtree/index.css"),
  fraunces: () => import("@fontsource-variable/fraunces/index.css"),
  geist: () => import("@fontsource-variable/geist/index.css"),
  "hanken-grotesk": () =>
    Promise.all([
      import("@fontsource-variable/hanken-grotesk/index.css"),
      import("@fontsource-variable/hanken-grotesk/wght-italic.css"),
    ]),
  "ibm-plex-sans": () =>
    Promise.all([
      import("@fontsource-variable/ibm-plex-sans/index.css"),
      import("@fontsource-variable/ibm-plex-sans/wght-italic.css"),
    ]),
  // The text faces load their italic too: they set whole documents, where an
  // emphasised phrase drawn as slanted roman is the first thing that looks off.
  "instrument-sans": () =>
    Promise.all([
      import("@fontsource-variable/instrument-sans/index.css"),
      import("@fontsource-variable/instrument-sans/wght-italic.css"),
    ]),
  inter: () => import("@fontsource-variable/inter/index.css"),
  "inter-tight": () =>
    Promise.all([
      import("@fontsource-variable/inter-tight/index.css"),
      import("@fontsource-variable/inter-tight/wght-italic.css"),
    ]),
  "libre-franklin": () =>
    Promise.all([
      import("@fontsource-variable/libre-franklin/index.css"),
      import("@fontsource-variable/libre-franklin/wght-italic.css"),
    ]),
  literata: () =>
    Promise.all([
      import("@fontsource-variable/literata/index.css"),
      import("@fontsource-variable/literata/wght-italic.css"),
    ]),
  manrope: () => import("@fontsource-variable/manrope/index.css"),
  mulish: () => import("@fontsource-variable/mulish/index.css"),
  newsreader: () =>
    Promise.all([
      import("@fontsource-variable/newsreader/index.css"),
      import("@fontsource-variable/newsreader/wght-italic.css"),
    ]),
  onest: () => import("@fontsource-variable/onest/index.css"),
  "playfair-display": () =>
    import("@fontsource-variable/playfair-display/index.css"),
  "plus-jakarta-sans": () =>
    import("@fontsource-variable/plus-jakarta-sans/index.css"),
  "public-sans": () =>
    Promise.all([
      import("@fontsource-variable/public-sans/index.css"),
      import("@fontsource-variable/public-sans/wght-italic.css"),
    ]),
  "schibsted-grotesk": () =>
    Promise.all([
      import("@fontsource-variable/schibsted-grotesk/index.css"),
      import("@fontsource-variable/schibsted-grotesk/wght-italic.css"),
    ]),
  "source-serif-4": () =>
    Promise.all([
      import("@fontsource-variable/source-serif-4/index.css"),
      import("@fontsource-variable/source-serif-4/wght-italic.css"),
    ]),
  "space-grotesk": () => import("@fontsource-variable/space-grotesk/index.css"),
};

const loadStatic = async (id: FontId): Promise<unknown> => {
  const font = findFont(id);
  const cuts = font?.cuts ?? [];
  const { STATIC_ITALICS, STATIC_STYLESHEETS } = await import(
    "./staticFontSheets"
  );
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
