import { isFontFamilyName, parseFontRef } from "../../config/fontRef.js";
import { FONT_CHOICES } from "../../config/theme.js";

/**
 * A font file to turn type into vector outlines with (the frame editor's
 * Convert to outlines), fetched here because the browser cannot get one:
 * Google serves WOFF2 to browsers, which opentype.js cannot read, and only
 * serves plain TrueType to a client it does not recognise — this function.
 *
 * Google and Fontshare faces only. Adobe Fonts' licence does not allow its
 * files to be fetched and read, and its CSS serves them obfuscated, so an
 * Adobe face is refused with a reason rather than drawn wrong.
 */

export type OutlineFontResult =
  | { bytes: ArrayBuffer; contentType: string; ok: true }
  | { error: string; ok: false; status: 400 | 404 | 422 };

const FONT_URL =
  /url\(\s*['"]?([^'")]+)['"]?\s*\)\s*format\(\s*['"]?([a-z-]+)['"]?\s*\)/gi;
const BARE_URL =
  /url\(\s*['"]?(https:\/\/fonts\.gstatic\.com\/[^'")]+)['"]?\s*\)/i;
/** Formats opentype.js reads: not WOFF2. */
const READABLE = new Set(["truetype", "opentype", "woff"]);
const MAX_FONT_BYTES = 8_000_000;

const fetchBytes = async (url: string): Promise<OutlineFontResult> => {
  const res = await fetch(url);
  if (!res.ok) {
    return {
      error: "The font file could not be fetched.",
      ok: false,
      status: 404,
    };
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_FONT_BYTES) {
    return {
      error: "That font file is too large to outline.",
      ok: false,
      status: 422,
    };
  }
  return {
    bytes,
    contentType: url.endsWith(".woff") ? "font/woff" : "font/ttf",
    ok: true,
  };
};

/** Google's static TrueType for a family at a weight, nearest it has. */
const googleFile = async (
  family: string,
  weight: number,
  italic: boolean
): Promise<OutlineFontResult> => {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  // Exactly the cut first; a family without it answers 400, and then its
  // default cut is taken rather than nothing.
  const tries = [
    `https://fonts.googleapis.com/css2?family=${name}:ital,wght@${italic ? 1 : 0},${weight}`,
    `https://fonts.googleapis.com/css2?family=${name}:wght@${weight}`,
    `https://fonts.googleapis.com/css2?family=${name}`,
  ];
  for (const url of tries) {
    // biome-ignore lint/performance/noAwaitInLoops: each only if the last had no such cut
    const res = await fetch(url, { headers: { "User-Agent": "outline-font" } });
    if (!res.ok) {
      continue;
    }
    const file = BARE_URL.exec(await res.text())?.[1];
    if (file) {
      return fetchBytes(file);
    }
  }
  return {
    error: `${family} is not a Google font, so it cannot be outlined here.`,
    ok: false,
    status: 404,
  };
};

/** Fontshare's TrueType or WOFF for a face at a weight. */
const fontshareFile = async (
  slug: string,
  weight: number,
  italic: boolean
): Promise<OutlineFontResult> => {
  const cut = `${weight}${italic ? "i" : ""}`;
  const res = await fetch(
    `https://api.fontshare.com/v2/css?f[]=${encodeURIComponent(`${slug}@${cut}`)}`
  );
  const css = res.ok ? await res.text() : "";
  for (const [, url = "", format = ""] of css.matchAll(FONT_URL)) {
    if (READABLE.has(format.toLowerCase())) {
      return fetchBytes(url.startsWith("//") ? `https:${url}` : url);
    }
  }
  return {
    error: "Fontshare has no outline-ready file for that face.",
    ok: false,
    status: 404,
  };
};

/**
 * The file for a text style's family: a brand font ref (`g:`, `f:`, `a:`)
 * or a plain family name, which is looked for on Google.
 */
export const outlineFont = (
  family: unknown,
  rawWeight: unknown,
  rawItalic: unknown
): Promise<OutlineFontResult> => {
  const weight = Math.min(
    900,
    Math.max(100, Math.round(Number(rawWeight) / 100) * 100 || 400)
  );
  const italic = rawItalic === "1" || rawItalic === "true";
  const ref = parseFontRef(family);
  if (ref?.source === "adobe") {
    return Promise.resolve({
      error:
        "Adobe Fonts can't be outlined: their licence doesn't allow the files to be read. Set the text in a Google or Fontshare face first.",
      ok: false,
      status: 422,
    });
  }
  if (ref?.source === "fontshare" && ref.slug) {
    return fontshareFile(ref.slug, weight, italic);
  }
  // One of the app's own faces: bundled from Google under a CSS name of its
  // own ("Climate Crisis Variable"), so asked for by its Google name, its
  // label. (Exposure, the one not on Google, is read from the site.)
  const app =
    ref?.source === "app"
      ? FONT_CHOICES.find((choice) => choice.id === ref.fontId)
      : undefined;
  const name = (app?.label ?? ref?.family ?? family) as unknown;
  if (!isFontFamilyName(name)) {
    return Promise.resolve({
      error: "Name a font family.",
      ok: false,
      status: 400,
    });
  }
  return googleFile(name, weight, italic);
};
