import { parseFontRef } from "../../../config/fontRef";
import { type FontId, findFont } from "../../../config/theme";
import { loadFont } from "../../theme/fonts";
import { loadFontRefReady } from "../../theme/remoteFonts";
import type { BoardItem } from "../../types";

/** fonts.check() alone returns true even before a remote stylesheet exists. */
export const textFontReady = async (
  el: HTMLTextAreaElement,
  item: BoardItem
): Promise<boolean> => {
  const family = item.textStyle?.family;
  const ref = parseFontRef(family);
  if (ref) {
    if (!(await loadFontRefReady(family))) {
      return false;
    }
  } else if (family) {
    await loadFont(family as FontId);
  } else {
    await document.fonts.ready;
  }
  const css = getComputedStyle(el);
  const face = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
  try {
    const faces = await document.fonts.load(face, el.value || " ");
    const custom = Boolean(ref || findFont(family ?? ""));
    return !custom || faces.length > 0;
  } catch {
    // Keep the saved box if the chosen face could not be loaded.
    return false;
  }
};
