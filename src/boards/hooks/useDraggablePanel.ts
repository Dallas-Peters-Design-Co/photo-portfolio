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
    x: Math.min(Math.max(MARGIN, point.x), window.innerWidth - width - MARGIN),
    y: Math.min(
      Math.max(MARGIN, point.y),
      window.innerHeight - Math.min(height, 48) - MARGIN
    ),
  };
};

export const useDraggablePanel = (storageKey: string) => {
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
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(false);
      write(storageKey, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const style: CSSProperties | undefined = position
    ? { left: position.x, top: position.y }
    : undefined;

  return { dragging, handleProps: { onPointerDown }, style };
};
