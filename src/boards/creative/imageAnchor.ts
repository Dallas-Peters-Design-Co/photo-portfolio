import type { BoardItem } from "../../types";

/**
 * Which part of a picture stays in view when its box is a different shape
 * from the picture: the anchor of the crop. Top left through bottom right,
 * centre by default. A picture always fills its box (cover); this says which
 * edge or corner it's pinned to as the box is resized.
 *
 * Kept in `config.position`, and read the same way by the editor, the board,
 * and every export.
 */

export const ANCHORS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;

export type Anchor = (typeof ANCHORS)[number];

const isAnchor = (value: unknown): value is Anchor =>
  typeof value === "string" && (ANCHORS as readonly string[]).includes(value);

export const anchorOf = (item: Pick<BoardItem, "config">): Anchor => {
  const value = (item.config as { position?: unknown } | null)?.position;
  return isAnchor(value) ? value : "center";
};

/** 0 at the start edge, 1 at the end, ½ when neither is named. */
const along = (anchor: Anchor, start: string, end: string): number => {
  if (anchor.includes(start)) {
    return 0;
  }
  return anchor.includes(end) ? 1 : 0.5;
};

/** The anchor as fractions across and down: 0, ½ or 1. */
export const anchorFractions = (anchor: Anchor): { x: number; y: number } => ({
  x: along(anchor, "left", "right"),
  y: along(anchor, "top", "bottom"),
});

/** CSS object-position, or nothing for the default centre. */
export const objectPositionOf = (
  item: Pick<BoardItem, "config">
): string | undefined => {
  const anchor = anchorOf(item);
  if (anchor === "center") {
    return;
  }
  const { x, y } = anchorFractions(anchor);
  return `${x * 100}% ${y * 100}%`;
};
