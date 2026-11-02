import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Box } from "./creativeModel";

/**
 * Zooming the frame editor's artboard.
 *
 * The artboard opens fitted to the stage. Zoom multiplies that fit, so "Fit"
 * is always 1 and works whatever the window size; past the fit, the stage
 * scrolls. Pinch on a trackpad (which the browser reports as a wheel with
 * Ctrl held) or ⌘/Ctrl + wheel zooms about the pointer, so what's under it
 * stays under it; ⌘+ and ⌘− zoom about the middle, ⌘0 fits again.
 */

const PAD = 64;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 16;
const STEP = 1.25;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const useArtboardZoom = (
  stageRef: RefObject<HTMLDivElement | null>,
  frame: Box
) => {
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  // The point (in canvas units) to keep under a screen spot through a zoom.
  const pin = useRef<{ cx: number; cy: number; sx: number; sy: number } | null>(
    null
  );
  const scale = fitScale * zoom;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) {
      return;
    }
    const fit = () =>
      setFitScale(
        Math.min(
          (el.clientWidth - PAD) / frame.width,
          (el.clientHeight - PAD) / frame.height
        )
      );
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageRef, frame.height, frame.width]);

  /** Zooms to `next`, keeping the canvas point at screen spot (sx, sy) put. */
  const zoomAt = useCallback(
    (next: number, sx?: number, sy?: number) => {
      const el = stageRef.current;
      const board = el?.querySelector<HTMLElement>(".creative__board");
      if (el && board) {
        const rect = el.getBoundingClientRect();
        const at = {
          x: sx ?? rect.left + rect.width / 2,
          y: sy ?? rect.top + rect.height / 2,
        };
        const b = board.getBoundingClientRect();
        pin.current = {
          cx: (at.x - b.left) / scale,
          cy: (at.y - b.top) / scale,
          sx: at.x - rect.left,
          sy: at.y - rect.top,
        };
      }
      setZoom(clampZoom(next));
    },
    [scale, stageRef]
  );

  // After the new size is laid out, scroll so the pinned point is back under
  // the spot it was zoomed about.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the scale changes, reading the pin set just before
  useLayoutEffect(() => {
    const el = stageRef.current;
    const board = el?.querySelector<HTMLElement>(".creative__board");
    const p = pin.current;
    pin.current = null;
    if (!(el && board && p)) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    const nowX = b.left - rect.left + p.cx * scale;
    const nowY = b.top - rect.top + p.cy * scale;
    el.scrollLeft += nowX - p.sx;
    el.scrollTop += nowY - p.sy;
  }, [scale]);

  // Pinch and ⌘/Ctrl + wheel.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      zoomAt(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stageRef, zoom, zoomAt]);

  // ⌘+ / ⌘− / ⌘0, before the browser zooms the whole page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) {
        return;
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomAt(zoom * STEP);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomAt(zoom / STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [zoom, zoomAt]);

  return {
    fit: () => setZoom(1),
    scale,
    zoomed: zoom !== 1,
    zoomIn: () => zoomAt(zoom * STEP),
    zoomOut: () => zoomAt(zoom / STEP),
  };
};
