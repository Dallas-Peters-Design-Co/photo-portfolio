import { textStyleCss } from "../../../config/textStyle";
import { loadFontRef } from "../../theme/remoteFonts";
import type { BoardItem } from "../../types";
import "../itemBodies.css";

/**
 * Text layers set off screen exactly as the artboard sets them, for frames
 * the editor isn't showing.
 *
 * The exports read a text layer's look from the element it was drawn in. The
 * open frame has those; exporting a whole deck needs them for every slide, so
 * each one gets a stand-in with the same classes and styles, measured, then
 * removed.
 */
export const withTextGhosts = async <T>(
  items: BoardItem[],
  run: (textElementFor: (id: string) => HTMLElement | null) => Promise<T>
): Promise<T> => {
  // Inside the editor where there is one, so board colour tokens resolve.
  const parent = document.querySelector(".creative") ?? document.body;
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
  parent.append(holder);
  const els = new Map<string, HTMLElement>();
  for (const item of items) {
    if (item.kind !== "text" && item.kind !== "note") {
      continue;
    }
    loadFontRef(item.textStyle?.family);
    const css = textStyleCss(item);
    const el = document.createElement("div");
    el.className = "creative__text text-body text-body--plain";
    Object.assign(el.style, {
      ...css,
      fontSize: `${css.fontSize}px`,
      fontWeight: `${css.fontWeight}`,
      height: `${item.height}px`,
      lineHeight: `${css.lineHeight}`,
      position: "absolute",
      width: `${item.width}px`,
    });
    el.textContent = item.body ?? "";
    holder.append(el);
    els.set(item.id, el);
  }
  try {
    return await run((id) => els.get(id) ?? null);
  } finally {
    holder.remove();
  }
};
