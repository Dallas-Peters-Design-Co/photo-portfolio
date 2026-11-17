import type { Font } from "opentype.js";
import { parseFontRef } from "../../../config/fontRef";
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

/** The face to outline with: the layer's brand ref, else what CSS drew. */
const familyOf = (item: BoardItem, css: CSSStyleDeclaration): string => {
  const family = item.textStyle?.family;
  if (family && parseFontRef(family)) {
    return family;
  }
  return FIRST_FAMILY.exec(css.fontFamily)?.[1]?.trim() ?? "";
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
      const res = await fetch(`${apiBase}/brand-kits?${query}`, {
        headers: jsonHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error ?? `Couldn't load ${family} to convert to a vector shape.`
        );
      }
      const { parse } = await import("opentype.js");
      return parse(await res.arrayBuffer());
    })();
    // A failure is not kept: the next try asks again.
    font.catch(() => fonts.delete(key));
    fonts.set(key, font);
  }
  return font;
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
  const config: DrawingConfig = {
    d: parts.join(""),
    fill: item.textStyle?.color ?? hexOf(css.color),
    stroke: "#00000000",
    strokeWidth: 0,
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
