import type { FontChoice, FontId } from "./theme.js";

/**
 * A static family from an @fontsource package: one file per weight rather
 * than a variable axis. `family` is the CSS name the package declares.
 */
const staticFont = (
  id: FontId,
  label: string,
  family: string,
  category: FontChoice["category"],
  cuts: number[],
  italic: boolean,
  fallback: string
): FontChoice => ({
  category,
  cuts,
  id,
  italic,
  label,
  stack: `"${family}", ${fallback}`,
  weight: { max: cuts.at(-1) ?? 400, min: cuts[0] ?? 400 },
});

/**
 * Static families. The display set is for titles: condensed and poster
 * faces, a few display serifs. Adding one is the package plus a line here;
 * the loader and the PDF read everything else from the entry.
 */
export const STATIC_FONTS: FontChoice[] = [
  staticFont(
    "oswald",
    "Oswald",
    "Oswald",
    "display",
    [200, 300, 400, 500, 600, 700],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "bebas-neue",
    "Bebas Neue",
    "Bebas Neue",
    "display",
    [400],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "anton",
    "Anton",
    "Anton",
    "display",
    [400],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "archivo-black",
    "Archivo Black",
    "Archivo Black",
    "display",
    [400],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "archivo-narrow",
    "Archivo Narrow",
    "Archivo Narrow",
    "display",
    [400, 500, 600, 700],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "big-shoulders-display",
    "Big Shoulders Display",
    "Big Shoulders Display",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "barlow-condensed",
    "Barlow Condensed",
    "Barlow Condensed",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "saira-condensed",
    "Saira Condensed",
    "Saira Condensed",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "saira-extra-condensed",
    "Saira Extra Condensed",
    "Saira Extra Condensed",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "teko",
    "Teko",
    "Teko",
    "display",
    [300, 400, 500, 600, 700],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "antonio",
    "Antonio",
    "Antonio",
    "display",
    [100, 200, 300, 400, 500, 600, 700],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "league-gothic",
    "League Gothic",
    "League Gothic",
    "display",
    [400],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "fjalla-one",
    "Fjalla One",
    "Fjalla One",
    "display",
    [400],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "roboto-condensed",
    "Roboto Condensed",
    "Roboto Condensed",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "sofia-sans-condensed",
    "Sofia Sans Condensed",
    "Sofia Sans Condensed",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "rajdhani",
    "Rajdhani",
    "Rajdhani",
    "display",
    [300, 400, 500, 600, 700],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "syne",
    "Syne",
    "Syne",
    "display",
    [400, 500, 600, 700, 800],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "unbounded",
    "Unbounded",
    "Unbounded",
    "display",
    [200, 300, 400, 500, 600, 700, 800, 900],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "bricolage-grotesque",
    "Bricolage Grotesque",
    "Bricolage Grotesque",
    "display",
    [200, 300, 400, 500, 600, 700, 800],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "chivo",
    "Chivo",
    "Chivo",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "archivo",
    "Archivo",
    "Archivo",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "outfit",
    "Outfit",
    "Outfit",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    false,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "red-hat-display",
    "Red Hat Display",
    "Red Hat Display",
    "display",
    [300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "epilogue",
    "Epilogue",
    "Epilogue",
    "display",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
  staticFont(
    "dm-serif-display",
    "DM Serif Display",
    "DM Serif Display",
    "display",
    [400],
    true,
    "Georgia, serif"
  ),
  staticFont(
    "instrument-serif",
    "Instrument Serif",
    "Instrument Serif",
    "display",
    [400],
    true,
    "Georgia, serif"
  ),
  staticFont(
    "bodoni-moda",
    "Bodoni Moda",
    "Bodoni Moda",
    "display",
    [400, 500, 600, 700, 800, 900],
    true,
    "Georgia, serif"
  ),
  staticFont(
    "young-serif",
    "Young Serif",
    "Young Serif",
    "display",
    [400],
    false,
    "Georgia, serif"
  ),
  staticFont(
    "barlow-semi-condensed",
    "Barlow Semi Condensed",
    "Barlow Semi Condensed",
    "sans",
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    true,
    "ui-sans-serif, system-ui, sans-serif"
  ),
];
