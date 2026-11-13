import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";

/**
 * Guides dragged onto a frame, kept on the frame itself (in its config) so
 * they're there next time and in every copy of it.
 *
 * Each guide is stored as a fraction of the frame (0 is the left or top edge,
 * 1 the right or bottom), so resizing the frame keeps them where they were
 * in the design. `x` guides are vertical lines, `y` guides horizontal.
 */

export interface FrameGuideSet {
  /** The size's safe zone switched off for this frame. */
  hideSafe?: boolean;
  x: number[];
  y: number[];
}

const fractions = (raw: unknown): number[] =>
  Array.isArray(raw)
    ? raw.filter((n): n is number => typeof n === "number" && n >= 0 && n <= 1)
    : [];

export const guidesOf = (frame: {
  config?: Record<string, unknown> | null;
}): FrameGuideSet => {
  const raw = frame.config?.guides as Partial<FrameGuideSet> | undefined;
  return {
    hideSafe: raw?.hideSafe === true,
    x: fractions(raw?.x),
    y: fractions(raw?.y),
  };
};

/** The patch that stores `next` on the frame, leaving the rest of its config. */
export const withGuides = (
  frame: BoardItem,
  next: FrameGuideSet
): Partial<BoardItem> => ({
  config: { ...(frame.config ?? {}), guides: next },
});

/** The frame's guides on one axis, in canvas units, for snapping to. */
export const guideLines = (frame: Box, axis: "x" | "y"): number[] => {
  const set = guidesOf(frame as { config?: Record<string, unknown> | null });
  return axis === "x"
    ? set.x.map((f) => frame.x + f * frame.width)
    : set.y.map((f) => frame.y + f * frame.height);
};

/** Where a guide dragged to `fraction` lands: on the middle when it's close. */
export const settleGuide = (fraction: number, slack: number): number =>
  Math.abs(fraction - 0.5) <= slack ? 0.5 : fraction;

/** A guide dragged off the frame is taken away. */
export const isOffFrame = (fraction: number): boolean =>
  fraction < 0 || fraction > 1;
