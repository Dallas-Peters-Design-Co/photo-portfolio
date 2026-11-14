import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react";

/**
 * Docking the Studio: floating (the default), or fixed down the left or
 * right side of the window at full height.
 *
 * Docked, it stops covering the work: the frame editor moves over to make
 * room (it reads the two variables set on the page below), and the panel's
 * inner edge drags to set its width. Dragging the floating panel to a side
 * of the window docks it there; the header's buttons dock and float it too.
 * Where it's docked and how wide are remembered in this browser.
 */

export type Dock = "float" | "left" | "right";

const KEY = "studio:dock";
const MIN_W = 420;
const DEFAULT_W = 560;
/** How near a side of the window a drag has to end to dock there. */
const EDGE = 28;

interface Saved {
  dock: Dock;
  width: number;
}

const read = (): Saved => {
  try {
    const raw = JSON.parse(
      localStorage.getItem(KEY) ?? "null"
    ) as Partial<Saved> | null;
    return {
      dock: raw?.dock === "left" || raw?.dock === "right" ? raw.dock : "float",
      width: typeof raw?.width === "number" ? raw.width : DEFAULT_W,
    };
  } catch {
    return { dock: "float", width: DEFAULT_W };
  }
};

const save = (next: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Remembering is a convenience.
  }
};

const clampWidth = (w: number) =>
  Math.round(Math.min(Math.max(MIN_W, w), window.innerWidth * 0.7));

/** The side a drag ended against, if it ended against one. */
export const sideAt = (clientX: number, windowWidth: number): Dock => {
  if (clientX <= EDGE) {
    return "left";
  }
  return clientX >= windowWidth - EDGE ? "right" : "float";
};

export const useStudioDock = () => {
  const [state, setState] = useState(read);
  const { dock } = state;
  const width = clampWidth(state.width);

  const set = (next: Dock) => {
    const saved = { ...state, dock: next };
    setState(saved);
    save(saved);
  };

  // The room the docked panel takes, for whatever sits beside it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--studio-dock-left",
      dock === "left" ? `${width}px` : "0px"
    );
    root.style.setProperty(
      "--studio-dock-right",
      dock === "right" ? `${width}px` : "0px"
    );
    return () => {
      root.style.removeProperty("--studio-dock-left");
      root.style.removeProperty("--studio-dock-right");
    };
  }, [dock, width]);

  /** Dragging the docked panel's inner edge sets its width. */
  const startResize = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || dock === "float") {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const from = e.clientX;
    const start = width;
    let last = start;
    const move = (ev: PointerEvent) => {
      const by = ev.clientX - from;
      last = clampWidth(start + (dock === "left" ? by : -by));
      setState((was) => ({ ...was, width: last }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      save({ dock, width: last });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const style: CSSProperties | undefined =
    dock === "float" ? undefined : { width };

  return {
    dock,
    /** A floating drag let go at a side of the window docks there. */
    dropAt: (clientX: number) => {
      const side = sideAt(clientX, window.innerWidth);
      if (side !== "float") {
        set(side);
      }
    },
    set,
    startResize,
    style,
  };
};
