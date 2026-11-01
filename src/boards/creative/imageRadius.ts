import type { BoardItem } from "../../types";

/**
 * A picture's corner radius in canvas units, set in the frame editor and by
 * bento layouts. Zero for square corners, which is every picture placed
 * before corners could be rounded.
 */
export const imageRadius = (item: BoardItem): number => {
  const radius = (item.config as { radius?: unknown } | null)?.radius;
  return typeof radius === "number" && Number.isFinite(radius) && radius > 0
    ? radius
    : 0;
};
