import type { Font } from "opentype.js";
import { OUTLINE_FONTS } from "./outlineFonts";

/**
 * Type as vector outlines, for tools whose words have to stay vector: an
 * SVG on the board can't load web fonts, so the letters go in as paths.
 * Faces are parsed with opentype.js from the site's own font files, once
 * each, and kept. Until one has loaded, `fontFor` answers null and asks for
 * it; the preview redraws when it arrives.
 */

export const OUTLINE_FAMILIES = Object.keys(OUTLINE_FONTS);

const loaded = new Map<string, Font>();
const loading = new Set<string>();

/** The file nearest the weight asked for. */
const fileFor = (family: string, weight: number): [string, string] | null => {
  const files = OUTLINE_FONTS[family] ?? OUTLINE_FONTS["DM Sans"];
  if (!files) {
    return null;
  }
  const weights = Object.keys(files).map(Number);
  const best = weights.reduce((a, b) =>
    Math.abs(b - weight) < Math.abs(a - weight) ? b : a
  );
  const url = files[best];
  return url ? [`${family}|${best}`, url] : null;
};

const load = async (key: string, url: string) => {
  loading.add(key);
  try {
    const [{ parse }, bytes] = await Promise.all([
      import("opentype.js"),
      fetch(url).then((r) => r.arrayBuffer()),
    ]);
    loaded.set(key, parse(bytes));
    // The previews redraw on this, as they do when a web font arrives.
    document.fonts.dispatchEvent(new Event("loadingdone"));
  } finally {
    loading.delete(key);
  }
};

/** The parsed face, or null while it loads (it's asked for). */
export const fontFor = (family: string, weight: number): Font | null => {
  const file = fileFor(family, weight);
  if (!file) {
    return null;
  }
  const [key, url] = file;
  const font = loaded.get(key);
  if (font) {
    return font;
  }
  if (!loading.has(key)) {
    void load(key, url);
  }
  return null;
};

/** Waits for the face, for a caller that can (a test, a full-size render). */
export const fontReady = async (
  family: string,
  weight: number
): Promise<Font | null> => {
  const file = fileFor(family, weight);
  if (!file) {
    return null;
  }
  if (!loaded.has(file[0])) {
    await load(file[0], file[1]);
  }
  return loaded.get(file[0]) ?? null;
};

/** A run of text as SVG path data, its baseline at (0, 0). */
export const textPath = (font: Font, text: string, size: number): string =>
  font.getPath(text, 0, 0, size).toPathData(2);

/** How wide a run of text sets at a size. */
export const textWidth = (font: Font, text: string, size: number): number =>
  font.getAdvanceWidth(text, size);
