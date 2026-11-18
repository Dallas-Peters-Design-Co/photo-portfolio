import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react";

/**
 * The frame editor's two side panels, at the widths you drag them to.
 *
 * Remembered in this browser, since it's a preference about your screen
 * rather than about any frame. Each panel can also be hidden outright (⌘\ for
 * the layers rail, ⇧⌘\ for the brand panel) to give the artboard the room.
 */

const KEY = "creative-editor:panels";
export const PANEL_MIN = 180;
export const PANEL_MAX = 520;
const DEFAULTS = { left: 240, leftOpen: true, right: 288, rightOpen: true };
type Panels = typeof DEFAULTS;

const clampWidth = (n: number, max = PANEL_MAX) =>
  Math.round(Math.min(max, Math.max(PANEL_MIN, n)));

const read = (storageKey: string): Panels => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKey) ?? "{}"
    ) as Partial<Panels>;
    return {
      left: clampWidth(Number(stored.left) || DEFAULTS.left),
      leftOpen: stored.leftOpen !== false,
      right: clampWidth(Number(stored.right) || DEFAULTS.right),
      rightOpen: stored.rightOpen !== false,
    };
  } catch {
    return DEFAULTS;
  }
};

export const usePanelWidths = (storageKey = KEY, viewportShare?: number) => {
  const [saved, setPanels] = useState<Panels>(() => read(storageKey));
  const limit = () =>
    viewportShare
      ? Math.min(PANEL_MAX, Math.floor(window.innerWidth * viewportShare))
      : PANEL_MAX;
  const [max, setMax] = useState(limit);
  useEffect(() => {
    if (!viewportShare) {
      return;
    }
    const resize = () =>
      setMax(
        Math.min(PANEL_MAX, Math.floor(window.innerWidth * viewportShare))
      );
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [viewportShare]);
  const panels = {
    ...saved,
    left: Math.min(max, saved.left),
    right: Math.min(max, saved.right),
  };

  const update = (next: Partial<Panels>) =>
    setPanels((was) => {
      const merged = { ...was, ...next };
      try {
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {
        // Private windows can refuse storage; the width still holds for now.
      }
      return merged;
    });

  /** A drag on a panel's inner edge; `side` says which way is wider. */
  const startDrag = (side: "left" | "right") => (e: ReactPointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    const startX = e.clientX;
    const from = panels[side];
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      update({
        [side]: clampWidth(side === "left" ? from + dx : from - dx, max),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  /** ← and → on a focused edge: 16px at a time. */
  const nudge = (side: "left" | "right", dx: number) =>
    update({
      [side]: clampWidth(panels[side] + (side === "left" ? dx : -dx), max),
    });

  return {
    /** The editor's class, with the hidden panels marked. */
    className: [
      "creative",
      panels.leftOpen ? "" : "creative--rail-hidden",
      panels.rightOpen ? "" : "creative--side-hidden",
    ]
      .filter(Boolean)
      .join(" "),
    max,
    nudge,
    panels,
    reset: (side: "left" | "right") => update({ [side]: DEFAULTS[side] }),
    startDrag,
    /** The grid columns: rail, artboard, brand panel. */
    style: {
      gridTemplateColumns: `${panels.leftOpen ? `${panels.left}px` : "0"} minmax(0, 1fr) ${panels.rightOpen ? `${panels.right}px` : "0"}`,
    },
    toggle: (side: "left" | "right") =>
      update(
        side === "left"
          ? { leftOpen: !panels.leftOpen }
          : { rightOpen: !panels.rightOpen }
      ),
  };
};
