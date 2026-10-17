/**
 * Every weight stylesheet of every static @fontsource package installed,
 * keyed by path and loaded lazily. A static family's entry in
 * config/staticFonts.ts says which weights it has; this is how they are fetched
 * without a hand-written import per cut.
 *
 * Its own module, imported on demand by fonts.ts: the table of paths is about
 * 30 KB, and a site whose fonts are all variable never needs it.
 */
export const STATIC_STYLESHEETS = import.meta.glob<unknown>(
  "/node_modules/@fontsource/*/[0-9][0-9][0-9].css"
);

export const STATIC_ITALICS = import.meta.glob<unknown>(
  "/node_modules/@fontsource/*/[0-9][0-9][0-9]-italic.css"
);
