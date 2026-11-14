import { type RefObject, useEffect, useRef } from "react";

/**
 * Keeps the board's drawing still while it's being zoomed or panned.
 *
 * Every change of the canvas's transform made the browser redraw everything
 * on it at the new scale: big type, shapes, component instances. On the 2027
 * posters board that was a 70-130ms frame on most zoom steps. While the view
 * is moving, `will-change: transform` lets the browser scale what it already
 * drew instead (smooth, slightly soft mid-zoom); a moment after it stops the
 * hint is dropped and everything is redrawn sharp once.
 *
 * Toggled on the element directly, not through React state, so moving the
 * view doesn't re-render the board twice a gesture.
 */
const SETTLE_MS = 180;
export const MOVING = "board-canvas__layer--moving";

export const useMovingLayer = (
  layerRef: RefObject<HTMLElement | null>,
  view: { scale: number; tx: number; ty: number }
) => {
  const timer = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every change of the view
  useEffect(() => {
    const el = layerRef.current;
    if (!el) {
      return;
    }
    el.classList.add(MOVING);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      el.classList.remove(MOVING);
      timer.current = null;
    }, SETTLE_MS);
  }, [view.scale, view.tx, view.ty]);
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    []
  );
};
