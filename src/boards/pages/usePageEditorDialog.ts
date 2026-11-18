import { type KeyboardEvent, useEffect, useRef } from "react";
import { requestHistory } from "../hooks/historyRequest";

const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex='0']";

/** A page editor owns focus and shortcuts while it covers the board. */
export const usePageEditorDialog = (onClose: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      } else {
        document.querySelector<HTMLElement>("[data-board-canvas]")?.focus();
      }
    };
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === "Escape") {
      close.current();
      return;
    }
    const typing =
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, [contenteditable=true]");
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "z" &&
      !typing
    ) {
      event.preventDefault();
      requestHistory(event.shiftKey);
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const items = [
      ...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    ];
    const [first] = items;
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return { onKeyDown, ref };
};
