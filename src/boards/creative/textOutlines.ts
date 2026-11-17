import type { Font } from "opentype.js";
import { parseFontRef } from "../../../config/fontRef";
import { FONT_CHOICES } from "../../../config/theme";
import { apiBase, jsonHeaders } from "../../services/portfolioService";
import type { BoardItem } from "../../types";
import type { DrawingConfig } from "../drawing/drawing";

/**
 * Convert to outlines: a text layer turned into a vector shape of the same
 * letters, where the browser drew them.
 *
 * Where each letter goes is measured, not recomputed: a hidden copy of the
 * text box, with every style the box has, is laid out by the browser, and
 * each character's box is read from it. So line breaks, alignment, letter
 * spacing, kerning and capitals all come out as on screen. What each letter
 * looks like comes from the font file (opentype.js), fetched by the server
 * (api/_lib/outlineFont.ts), since browsers are given WOFF2, which
 * opentype.js can't read.
 *
 * Fill colour carries over; an outline stroke or a box behind the words does
 * not — the result is the letters.
 */

const fonts = new Map<string, Promise<Font>>();

const FIRST_FAMILY = /^\s*["']?([^"',]+)["']?/;
const RGB = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/;
const WHITESPACE = /\s/;

/**
 * The app's own faces whose files are on the site rather than on Google:
 * read straight from here, since no font service has them.
 */
const SAUCE_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
const LOCAL_FONT_FILES: Record<string, (weight: number) => string> = {
  exposure: () => "/fonts/Exposure0-Regular.woff",
  // Bundled by @fontsource, not served by Google; its files are copied to
  // public/fonts (OFL, licence in public/font-licenses).
  "open-sauce-sans": (weight) => {
    const near = SAUCE_WEIGHTS.reduce((a, b) =>
      Math.abs(b - weight) < Math.abs(a - weight) ? b : a
    );
    return `/fonts/open-sauce-sans/open-sauce-sans-latin-${near}-normal.woff`;
  },
};

/** One of the app's own faces, by its id or the family its CSS names. */
const appFontOf = (family: string) =>
  FONT_CHOICES.find(
    (choice) => choice.id === family || choice.stack.startsWith(`"${family}"`)
  );

/**
 * The face to outline with: the layer's brand ref, one of the app's own
 * faces (stored by id, as "figtree" or "exposure") as its ref, else what CSS
 * drew. An app face went to the server by its CSS name ("Figtree Variable",
 * "Exposure[0]"), which no font service knows: "Name a font family."
 */
const familyOf = (item: BoardItem, css: CSSStyleDeclaration): string => {
  const family = item.textStyle?.family;
  if (family && parseFontRef(family)) {
    return family;
  }
  const drawn = FIRST_FAMILY.exec(css.fontFamily)?.[1]?.trim() ?? "";
  const app = appFontOf(family ?? "") ?? appFontOf(drawn);
  return app ? `p:${app.id}` : drawn;
};

/** A font file's bytes: the site's own copy, else from the server. */
const fontFile = (
  family: string,
  query: URLSearchParams
): Promise<Response> => {
  const local = LOCAL_FONT_FILES[parseFontRef(family)?.fontId ?? ""];
  return local
    ? fetch(local(Number(query.get("weight")) || 400))
    : fetch(`${apiBase()}/api/brand-kits?${query}`, {
        headers: jsonHeaders(),
      });
};

const loadFont = (family: string, weight: string, italic: boolean) => {
  const key = `${family}|${weight}|${italic}`;
  let font = fonts.get(key);
  if (!font) {
    font = (async () => {
      const query = new URLSearchParams({
        italic: italic ? "1" : "0",
        outlineFont: family,
        weight,
      });
      const res = await fontFile(family, query);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error ?? `Couldn't load ${family} to convert to a vector shape.`
        );
      }
      const { parse } = await import("opentype.js");
      // A page rather than a font (a wrong address answered by the site's
      // own fallback) said "Unsupported OpenType signature" — say what it is.
      if ((res.headers.get("content-type") ?? "").includes("text/html")) {
        throw new Error(`Couldn't get the font file for ${family}.`);
      }
      return parse(await res.arrayBuffer());
    })();
    // A failure is not kept: the next try asks again.
    font.catch(() => fonts.delete(key));
    fonts.set(key, font);
  }
  return font;
};

/**
 * How much the browser thickens a face that has no bold of its own when
 * it's set bold (Exposure, Climate Crisis: one weight each): Chromium's
 * synthetic bold, an outline of 1/24 of the size at 9px easing to 1/32 at
 * 36px and up. 0 when the font has the weight, or synthesis is off.
 */
const fakeBold = (css: CSSStyleDeclaration, font: Font, size: number) => {
  const wanted = Number.parseInt(css.fontWeight, 10) || 400;
  const os2 = font.tables.os2 as { usWeightClass?: number } | undefined;
  const has = os2?.usWeightClass ?? 400;
  const synthesis = css.getPropertyValue("font-synthesis-weight");
  if (wanted < 600 || has >= 600 || synthesis === "none") {
    return 0;
  }
  const t = Math.min(1, Math.max(0, (size - 9) / (36 - 9)));
  return Math.round(size * (1 / 24 + (1 / 32 - 1 / 24) * t) * 100) / 100;
};

/** Every style that decides where the words fall, copied to the mirror. */
const COPIED = [
  "boxSizing",
  "fontFamily",
  "fontFeatureSettings",
  "fontKerning",
  "fontSize",
  "fontStretch",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "overflowWrap",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "tabSize",
  "textAlign",
  "textIndent",
  "textTransform",
  "wordBreak",
  "wordSpacing",
] as const;

interface Glyph {
  char: string;
  /** Where in the text it is, for what comes before it. */
  index: number;
  left: number;
  top: number;
}

/** Each visible character's box in the text box, laid out by the browser. */
const measure = (
  el: HTMLTextAreaElement,
  css: CSSStyleDeclaration
): Glyph[] => {
  const mirror = document.createElement("div");
  for (const key of COPIED) {
    mirror.style[key] = css[key];
  }
  Object.assign(mirror.style, {
    borderStyle: "solid",
    borderWidth: css.borderWidth,
    height: `${el.offsetHeight}px`,
    left: "-100000px",
    position: "fixed",
    top: "0",
    visibility: "hidden",
    whiteSpace: el.wrap === "off" ? "pre" : "pre-wrap",
    width: `${el.offsetWidth}px`,
  });
  // The text the box shows, transformed as CSS draws it, so each measured
  // character is the one whose outline is drawn.
  const node = document.createTextNode(el.value);
  mirror.append(node);
  document.body.append(mirror);
  try {
    const origin = mirror.getBoundingClientRect();
    const range = document.createRange();
    const glyphs: Glyph[] = [];
    const text = el.value;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i] ?? "";
      if (WHITESPACE.test(char)) {
        continue;
      }
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const box = range.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        continue;
      }
      glyphs.push({
        char,
        index: i,
        left: box.left - origin.left,
        top: box.top - origin.top,
      });
    }
    return glyphs;
  } finally {
    mirror.remove();
  }
};

const transformed = (char: string, transform: string): string => {
  if (transform === "uppercase") {
    return char.toUpperCase();
  }
  if (transform === "lowercase") {
    return char.toLowerCase();
  }
  return char;
};

const hexOf = (color: string): string => {
  const m = RGB.exec(color);
  if (!m) {
    return "#000000";
  }
  return `#${[m[1], m[2], m[3]]
    .map((v) => Number(v).toString(16).padStart(2, "0"))
    .join("")}`;
};

/**
 * The text layer as a vector drawing: same box, place, order and rotation,
 * its letters filled in its colour. Throws with a reason a person can act
 * on (an Adobe face, a font Google doesn't have).
 */
export const outlineTextLayer = async (
  item: BoardItem,
  el: HTMLTextAreaElement
): Promise<BoardItem> => {
  const css = getComputedStyle(el);
  const family = familyOf(item, css);
  if (!family) {
    throw new Error("This text has no font to convert to a vector shape.");
  }
  const italic = css.fontStyle === "italic" || css.fontStyle === "oblique";
  const font = await loadFont(family, css.fontWeight, italic);
  const size = Number.parseFloat(css.fontSize);
  const scale = size / font.unitsPerEm;
  // The browser puts a line's text with its ascent above the baseline; a
  // character's box starts at the top of that ascent.
  const ascent = font.tables.hhea?.ascender ?? font.ascender;
  const capitalise = css.textTransform === "capitalize";
  const glyphs = measure(el, css);
  const parts: string[] = [];
  for (const glyph of glyphs) {
    const before = el.value[glyph.index - 1] ?? " ";
    const char =
      capitalise && WHITESPACE.test(before)
        ? glyph.char.toUpperCase()
        : transformed(glyph.char, css.textTransform);
    const d = font
      .charToGlyph(char)
      .getPath(glyph.left, glyph.top + ascent * scale, size)
      .toPathData(2);
    if (d) {
      parts.push(d);
    }
  }
  if (parts.length === 0) {
    throw new Error("There are no letters to convert to a vector shape.");
  }
  const fill = item.textStyle?.color ?? hexOf(css.color);
  const bolder = fakeBold(css, font, size);
  const config: DrawingConfig = {
    d: parts.join(""),
    fill,
    // A face with no bold, set bold, is thickened by the browser; the
    // outline copies that, or the shape came out a weight lighter.
    stroke: bolder > 0 ? fill : "#00000000",
    strokeWidth: bolder,
    tool: "vector",
    viewHeight: el.offsetHeight,
    viewWidth: el.offsetWidth,
  };
  return {
    ...item,
    body: null,
    config: config as unknown as Record<string, unknown>,
    fontSize: null,
    kind: "drawing",
    textStyle: null,
  };
};
