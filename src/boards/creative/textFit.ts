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
] as const;

/** The size the text needs, in the box's own units (the canvas's). */
export const measureText = (
  el: HTMLTextAreaElement,
  fit: Exclude<TextFit, "fixed">,
  width: number
): { height: number; width: number } | null => {
  const host = el.parentElement;
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
  const out = {
    height: Math.ceil(mirror.offsetHeight),
    width: Math.ceil(mirror.offsetWidth),
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
