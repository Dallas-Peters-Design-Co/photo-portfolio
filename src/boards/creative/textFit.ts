import type { BoardItem } from "../../types";

/**
 * Text boxes that fit their words.
 *
 *   fixed   the box is what it was drawn as (the default)
 *   height  the width is kept and the box grows or shrinks to the lines
 *   both    one line per paragraph: the box hugs the text both ways
 *
 * Stored on the layer's config as `autosize`. Measured from a copy of the
 * text box with the same computed styles, laid out next to it, so the font,
 * tracking, padding and background box all count.
 */

export type TextFit = "both" | "fixed" | "height";

export const textFitOf = (item: Pick<BoardItem, "config">): TextFit => {
  const v = (item.config as { autosize?: unknown } | null)?.autosize;
  return v === "height" || v === "both" ? v : "fixed";
};

const COPIED = [
  "boxSizing",
  "fontFamily",
  "fontKerning",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderTopWidth",
  "borderStyle",
  "textTransform",
  "wordSpacing",
  "tabSize",
  "fontStretch",
  "fontVariant",
  "fontFeatureSettings",
  "fontVariationSettings",
  "fontOpticalSizing",
  "textRendering",
  "textIndent",
] as const;

/**
 * Room for the browser's own rounding. A textarea exactly as wide as its
 * line can still wrap the last word.
 */
const SLACK = 1;

/** The size the text needs, in the box's own units (the canvas's). */
export const measureText = (
  el: HTMLTextAreaElement,
  fit: Exclude<TextFit, "fixed">,
  width: number
): { height: number; width: number } | null => {
  // Measured on the page itself, not inside the layer: the artboard is scaled
  // and the layer may be rotated, and either would bend the fractional size
  // read below. Every style that shapes the words is copied, so where the
  // copy sits doesn't change how it sets.
  const host = el.ownerDocument.body;
  if (!host) {
    return null;
  }
  const css = getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const key of COPIED) {
    mirror.style[key] = css[key];
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.left = "0";
  mirror.style.top = "0";
  mirror.style.whiteSpace = fit === "both" ? "pre" : "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.width = fit === "both" ? "max-content" : `${width}px`;
  // A trailing newline still makes a line, as it does in the text box.
  mirror.textContent =
    `${el.value}${el.value.endsWith("\n") ? " " : ""}` || " ";
  host.append(mirror);
  // offsetWidth rounds to the nearest pixel, so a line 312.4px wide came back
  // as 312 and the box was a fraction too narrow: the last word wrapped onto
  // a line the fitted height had no room for, and was cut off.
  const rect = mirror.getBoundingClientRect();
  const out = {
    height: Math.ceil(rect.height),
    width: Math.ceil(rect.width) + (fit === "both" ? SLACK : 0),
  };
  mirror.remove();
  return out;
};

/**
 * A box hugging its text both ways, given a width by hand: it keeps that
 * width and fits its height from then on, as a design tool does.
 */
export const widthSetBy = (
  drag: { id: string; kind: string; origin: { width: number } },
  box: { width: number },
  layers: BoardItem[]
): Partial<BoardItem> => {
  const item = layers.find((l) => l.id === drag.id);
  if (
    !item ||
    drag.kind !== "resize" ||
    textFitOf(item) !== "both" ||
    Math.abs(box.width - drag.origin.width) < 1
  ) {
    return {};
  }
  return { config: { ...(item.config ?? {}), autosize: "height" } };
};

/** How far across (0 left, 1 right) a box's words are pinned. */
const across = (item: Pick<BoardItem, "textStyle">): number => {
  const align = item.textStyle?.align;
  if (align === "center") {
    return 0.5;
  }
  return align === "right" ? 1 : 0;
};

/** How far down (0 top, 1 bottom) a box's words are pinned. */
const down = (item: Pick<BoardItem, "textStyle">): number => {
  const v = (item.textStyle as { verticalAlign?: unknown } | null)
    ?.verticalAlign;
  if (v === "middle") {
    return 0.5;
  }
  return v === "bottom" ? 1 : 0;
};

/**
 * A fitted box's new size, and where it moves so its words stay put: a
 * centred headline grows or shrinks about its middle, right-aligned type
 * about its right edge, bottom-aligned about its foot.
 *
 * Fitting kept the top-left corner, so a centred line that measured a little
 * narrower on opening (a font still loading, a word changed) slid left, and
 * every open moved it again. Null when the box already fits.
 */
export const fitPatch = (
  item: Pick<BoardItem, "height" | "textStyle" | "width" | "x" | "y">,
  fit: Exclude<TextFit, "fixed">,
  size: { height: number; width: number }
): Partial<BoardItem> | null => {
  const patch: Partial<BoardItem> = {};
  if (Math.abs(size.height - item.height) > 1) {
    patch.height = size.height;
    patch.y = item.y + (item.height - size.height) * down(item);
  }
  if (fit === "both" && Math.abs(size.width - item.width) > 1) {
    patch.width = size.width;
    patch.x = item.x + (item.width - size.width) * across(item);
  }
  return Object.keys(patch).length > 0 ? patch : null;
};
