import { type PointerEvent as ReactPointerEvent, useState } from "react";

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

const clampWidth = (n: number) =>
  Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, n)));

const read = (): Panels => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(KEY) ?? "{}"
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

export const usePanelWidths = () => {
  const [panels, setPanels] = useState<Panels>(read);

  const update = (next: Partial<Panels>) =>
    setPanels((was) => {
      const merged = { ...was, ...next };
      try {
        localStorage.setItem(KEY, JSON.stringify(merged));
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
      update({ [side]: clampWidth(side === "left" ? from + dx : from - dx) });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  /** ← and → on a focused edge: 16px at a time. */
  const nudge = (side: "left" | "right", dx: number) =>
    update({ [side]: clampWidth(panels[side] + (side === "left" ? dx : -dx)) });

  return {
    /** The editor's class, with the hidden panels marked. */
    className: [
      "creative",
      panels.leftOpen ? "" : "creative--rail-hidden",
      panels.rightOpen ? "" : "creative--side-hidden",
    ]
      .filter(Boolean)
      .join(" "),
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
