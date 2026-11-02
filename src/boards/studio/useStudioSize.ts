import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useState,
} from "react";

/**
 * The Studio's size: its width and its preview's height, set by dragging a
 * corner (of the preview or of the panel) and remembered in this browser.
 * Everything else in the panel follows: the controls reflow to the width,
 * and the panel grows with the preview until it reaches the window's height.
 */

const KEY = "studio:size";
const MIN_W = 520;
const MIN_PREVIEW = 160;

interface Size {
  preview: number;
  width: number;
}

const DEFAULT: Size = { preview: 240, width: 800 };

const read = (): Size => {
  try {
    const raw = JSON.parse(
      localStorage.getItem(KEY) ?? "null"
    ) as Partial<Size> | null;
    return typeof raw?.width === "number" && typeof raw.preview === "number"
      ? { preview: raw.preview, width: raw.width }
      : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

const clamp = (size: Size): Size => ({
  preview: Math.round(
    Math.min(Math.max(MIN_PREVIEW, size.preview), window.innerHeight * 0.75)
  ),
  width: Math.round(
    Math.min(Math.max(MIN_W, size.width), window.innerWidth - 32)
  ),
});

export const useStudioSize = (
  /** Fixes the panel's left edge where it is, so the dragged corner follows. */
  pin: (panel: HTMLElement) => void
) => {
  const [size, setSize] = useState(read);

  const startResize = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const panel = e.currentTarget.closest<HTMLElement>(".studio");
    if (panel) {
      pin(panel);
    }
    const from = { x: e.clientX, y: e.clientY };
    const start = size;
    let last = start;
    const move = (ev: PointerEvent) => {
      last = clamp({
        preview: start.preview + (ev.clientY - from.y),
        width: start.width + (ev.clientX - from.x),
      });
      setSize(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(KEY, JSON.stringify(last));
      } catch {
        // Remembering is a convenience.
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const reset = () => {
    setSize(DEFAULT);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // As above.
    }
  };

  const style = {
    "--studio-preview-h": `${size.preview}px`,
    width: `min(${size.width}px, calc(100vw - 2rem))`,
  } as CSSProperties;

  return { reset, startResize, style };
};
