import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useState,
} from "react";

/**
 * A floating panel you can move by its header.
 *
 * The position is in screen pixels (the panel is chrome, not canvas), kept
 * on screen, and remembered per panel in localStorage. Pointer-downs on
 * controls inside the header (selects, buttons, inputs) are left alone so
 * they still work.
 */

interface Point {
  x: number;
  y: number;
}

const MARGIN = 8;
/** How much of a panel is kept on screen, across, at the least. */
const VISIBLE = 240;
const INTERACTIVE = "button, select, input, textarea, a, [role='button']";

const read = (key: string): Point | null => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Partial<Point>) : null;
    return typeof parsed?.x === "number" && typeof parsed?.y === "number"
      ? { x: parsed.x, y: parsed.y }
      : null;
  } catch {
    return null;
  }
};

const write = (key: string, point: Point) => {
  try {
    localStorage.setItem(key, JSON.stringify(point));
  } catch {
    // Remembering the spot is a nicety; the panel still moves without it.
  }
};

const clamp = (point: Point, el: HTMLElement): Point => {
  const { height, width } = el.getBoundingClientRect();
  return {
    // The left edge wins when the panel is wider than the window: its grip
    // and first buttons stay reachable, and the answer never flips between two.
    x: Math.max(MARGIN, Math.min(point.x, window.innerWidth - width - MARGIN)),
    y: Math.min(
      Math.max(MARGIN, point.y),
      window.innerHeight - Math.min(height, 48) - MARGIN
    ),
  };
};

export const useDraggablePanel = (
  storageKey: string,
  /** Told where the pointer was when a drag was let go. */
  onDrop?: (pointer: { x: number; y: number }) => void
) => {
  const [position, setPosition] = useState<Point | null>(() =>
    read(storageKey)
  );
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE)) {
      return;
    }
    const panel = event.currentTarget.parentElement;
    if (!panel) {
      return;
    }
    event.preventDefault();
    const start = panel.getBoundingClientRect();
    const offset = {
      x: event.clientX - start.left,
      y: event.clientY - start.top,
    };
    let last: Point = { x: start.left, y: start.top };
    setDragging(true);

    const move = (e: PointerEvent) => {
      last = clamp({ x: e.clientX - offset.x, y: e.clientY - offset.y }, panel);
      setPosition(last);
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(false);
      write(storageKey, last);
      if (e.type === "pointerup") {
        onDrop?.({ x: e.clientX, y: e.clientY });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Never drawn off screen: a spot remembered on a bigger window (an external
  // display, then the laptop) put the Studio somewhere it couldn't be seen, so
  // opening it looked like nothing happened. At least its header stays in view.
  const style: CSSProperties | undefined = position
    ? {
        left: Math.max(
          MARGIN,
          Math.min(position.x, window.innerWidth - VISIBLE - MARGIN)
        ),
        top: Math.max(
          MARGIN,
          Math.min(position.y, window.innerHeight - 48 - MARGIN)
        ),
      }
    : undefined;

  /** Back to where the panel's own CSS puts it. */
  const reset = () => {
    setPosition(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Nothing remembered to forget.
    }
  };

  /**
   * Pulls a moved panel back on screen when it no longer fits where it was put:
   * after it grows (unfolded, a wider row of buttons) or the window shrinks.
   */
  const fit = (panel: HTMLElement | null) => {
    if (!(panel && position)) {
      return;
    }
    const box = panel.getBoundingClientRect();
    const onScreen =
      box.left >= 0 &&
      box.right <= window.innerWidth &&
      box.top >= 0 &&
      box.top <= window.innerHeight - 48;
    if (onScreen) {
      return;
    }
    const next = clamp(position, panel);
    // Whole pixels only: a sub-pixel difference re-rendered forever.
    if (
      Math.abs(next.x - position.x) >= 1 ||
      Math.abs(next.y - position.y) >= 1
    ) {
      setPosition(next);
      write(storageKey, next);
    }
  };

  /** Holds the panel where it is now, by its left edge (for resizing). */
  const pin = (panel: HTMLElement) => {
    if (position) {
      return;
    }
    const { left, top } = panel.getBoundingClientRect();
    setPosition({ x: left, y: top });
    write(storageKey, { x: left, y: top });
  };

  return { dragging, fit, handleProps: { onPointerDown }, pin, reset, style };
};
