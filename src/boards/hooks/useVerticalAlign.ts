import { type RefObject, useLayoutEffect } from "react";
import type { BoardItem } from "../../types";

/**
 * Sets a text layer's words in the middle or at the bottom of its box.
 *
 * A textarea can't align its contents vertically, so the words are measured
 * and the space above them is made up with top padding. Padding, because the
 * PNG and HTML5 exports already read a text layer's top padding to place its
 * first line, so they come out aligned the same way with no more work.
 */

const COPIED = [
  "boxSizing",
  "fontFamily",
  "fontKerning",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "overflowWrap",
  "paddingLeft",
  "paddingRight",
  "tabSize",
  "textTransform",
  "wordBreak",
  "wordSpacing",
] as const;

/** The height the words take at the box's width, without vertical padding. */
export const wordsHeight = (el: HTMLTextAreaElement): number => {
  const css = getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const prop of COPIED) {
    mirror.style[prop] = css[prop];
  }
  Object.assign(mirror.style, {
    paddingBottom: "0",
    paddingTop: "0",
    position: "absolute",
    top: "-10000px",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    width: `${el.offsetWidth}px`,
  });
  // A trailing newline makes a line of its own in a textarea, not in a div.
  mirror.textContent = el.value.endsWith("\n") ? `${el.value} ` : el.value;
  document.body.append(mirror);
  const height = mirror.offsetHeight;
  mirror.remove();
  return height;
};

const align = (el: HTMLTextAreaElement, item: BoardItem) => {
  const where = item.textStyle?.verticalAlign;
  // Back to whatever padding the style gives, before measuring or for good.
  el.style.paddingTop = el.style.paddingBottom;
  if (!where) {
    return;
  }
  const pad = Number.parseFloat(getComputedStyle(el).paddingTop) || 0;
  const room = el.clientHeight - pad * 2 - wordsHeight(el);
  if (room > 0) {
    el.style.paddingTop = `${pad + (where === "middle" ? room / 2 : room)}px`;
  }
  // A field that ever overflowed (mid-edit, or measured in a fallback font)
  // keeps its scroll, which lifts the words off where they were placed.
  el.scrollTop = 0;
};

/** This field's own font, by its CSS shorthand, for document.fonts.load. */
const fontOf = (el: HTMLElement): string => {
  const css = getComputedStyle(el);
  return `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
};

export const useVerticalAlign = (
  ref: RefObject<HTMLTextAreaElement | null>,
  item: BoardItem
) => {
  const { body, fontSize, height, textStyle, width } = item;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measured whenever anything that moves the words changes
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    align(el, item);
    // Again once the field's own font has arrived: measured in a fallback, a
    // narrow display face wraps differently and the words land too high.
    // `fonts.ready` alone isn't enough, since a brand font's stylesheet may
    // not have started loading yet when it resolves.
    let alive = true;
    const again = () => alive && align(el, item);
    const { fonts } = document;
    if (fonts) {
      void fonts.load(fontOf(el), el.value || "x").then(again, again);
      void fonts.ready.then(again);
      fonts.addEventListener("loadingdone", again);
    }
    return () => {
      alive = false;
      fonts?.removeEventListener("loadingdone", again);
    };
  }, [ref, body, fontSize, height, textStyle, width]);
};
