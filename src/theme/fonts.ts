import type { FontId } from "../../config/theme";

/**
 * Dynamic imports rather than top-level ones: Vite splits each font's CSS into
 * its own chunk, so a visitor downloads only the family the site actually uses
 * instead of all seven.
 */
const FONT_LOADERS: Record<FontId, () => Promise<unknown>> = {
  // A static family rather than a variable one: @fontsource ships each
  // weight as its own stylesheet, so the range config/theme.ts declares is
  // loaded here cut by cut.
  "barlow-semi-condensed": () =>
    Promise.all([
      import("@fontsource/barlow-semi-condensed/300.css"),
      import("@fontsource/barlow-semi-condensed/400.css"),
      import("@fontsource/barlow-semi-condensed/400-italic.css"),
      import("@fontsource/barlow-semi-condensed/500.css"),
      import("@fontsource/barlow-semi-condensed/600.css"),
      import("@fontsource/barlow-semi-condensed/700.css"),
      import("@fontsource/barlow-semi-condensed/800.css"),
      import("@fontsource/barlow-semi-condensed/900.css"),
    ]),
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

const loaded = new Set<FontId>();

/** Loads a font's stylesheet once per session. Failures are non-fatal. */
export const loadFont = async (id: FontId): Promise<void> => {
  if (loaded.has(id)) {
    return;
  }
  loaded.add(id);
  try {
    await FONT_LOADERS[id]?.();
  } catch {
    // The stack in config/theme.ts ends in a system fallback, so a font that
    // fails to load degrades to system UI rather than breaking the page.
    loaded.delete(id);
  }
};
