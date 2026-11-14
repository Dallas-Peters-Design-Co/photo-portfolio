/**
 * The colours an SVG is painted with, and the SVG with some of them changed.
 *
 * Read from where SVG puts paint: the fill, stroke and gradient-stop
 * attributes, and the same properties in style="" and <style> blocks. Each
 * value is put through the browser's own colour parser, so `#f00`, `red` and
 * `rgb(255, 0, 0)` are one colour here, and changing it changes all three
 * spellings. References (`url(#gradient)`), `none`, `currentColor` and the
 * like aren't colours to edit and are left alone.
 */

const PAINT =
  /((?:^|[\s"';{])(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*(?:=\s*["']|:\s*))([^"';}]+)/gi;

const NOT_A_COLOUR =
  /^(?:none|inherit|currentcolor|transparent|url\(|var\(|context-)/i;

let probe: CanvasRenderingContext2D | null = null;

const two = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const RGBA = /^rgba?\(([^)]+)\)$/;

/** A colour as the browser reads it: `#rrggbb` (with `aa` when it isn't opaque). */
export const normalizeColour = (raw: string): string | null => {
  const value = raw.trim();
  if (!value || NOT_A_COLOUR.test(value)) {
    return null;
  }
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) {
    return null;
  }
  // An invalid value leaves fillStyle as it was: set twice from two
  // different starts, and a real colour reads the same both times.
  probe.fillStyle = "#000001";
  probe.fillStyle = value;
  const first = probe.fillStyle;
  probe.fillStyle = "#000002";
  probe.fillStyle = value;
  if (first !== probe.fillStyle) {
    return null;
  }
  const m = RGBA.exec(first);
  if (!m) {
    return first.toLowerCase();
  }
  const [r = 0, g = 0, b = 0, a = 1] = (m[1] ?? "").split(",").map(Number);
  return `#${two(r)}${two(g)}${two(b)}${a < 1 ? two(a * 255) : ""}`;
};

export interface SvgColour {
  /** How many places it's used. */
  count: number;
  hex: string;
}

/** Every colour the SVG paints with, most used first. */
export const svgColoursOf = (svg: string): SvgColour[] => {
  const found = new Map<string, number>();
  for (const match of svg.matchAll(PAINT)) {
    const hex = normalizeColour(match[2] ?? "");
    if (hex) {
      found.set(hex, (found.get(hex) ?? 0) + 1);
    }
  }
  return [...found]
    .map(([hex, count]) => ({ count, hex }))
    .sort((a, b) => b.count - a.count);
};

/** The SVG with each colour in `changes` (old hex → new) swapped everywhere. */
export const recolourSvg = (
  svg: string,
  changes: ReadonlyMap<string, string>
): string =>
  svg.replace(PAINT, (whole, lead: string, value: string) => {
    const hex = normalizeColour(value);
    const next = hex ? changes.get(hex) : undefined;
    // The value's own trailing space, if any, is kept where it was.
    return next
      ? `${lead}${next}${value.slice(value.trimEnd().length)}`
      : whole;
  });
