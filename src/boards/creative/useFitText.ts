import { type RefObject, useEffect, useRef } from "react";
import type { BoardItem } from "../../types";
import { fitPatch, measureText, textFitOf } from "./textFit";
import { textFontReady } from "./textFontReady";

/** Opening a saved frame is read-only; fitting follows an actual type edit. */
export const useFitText = (
  own: RefObject<HTMLTextAreaElement | null>,
  item: BoardItem,
  onFit?: (patch: Partial<BoardItem>) => void
) => {
  const fit = textFitOf(item);
  const signature = JSON.stringify([
    fit,
    item.body,
    item.fontSize,
    item.textStyle,
    item.width,
  ]);
  const fitted = useRef(signature);
  const live = useRef({ item, onFit });
  live.current = { item, onFit };

  useEffect(() => {
    const el = own.current;
    if (fit === "fixed" || !el || !live.current.onFit) {
      fitted.current = signature;
      return;
    }
    if (fitted.current === signature) {
      return;
    }
    let alive = true;
    void (async () => {
      if (!((await textFontReady(el, live.current.item)) && alive)) {
        return;
      }
      const current = live.current.item;
      const size = measureText(el, fit, current.width);
      const patch = size ? fitPatch(current, fit, size) : null;
      fitted.current = signature;
      if (patch) {
        live.current.onFit?.(patch);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fit, own, signature]);
};
