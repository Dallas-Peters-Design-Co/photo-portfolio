import type { BoardItem } from "../../types";

/**
 * Which part of a picture stays in view when its box is a different shape
 * from the picture: the anchor of the crop. Top left through bottom right,
 * centre by default. A picture always fills its box (cover); this says which
 * edge or corner it's pinned to as the box is resized.
 *
 * Kept in `config.position`, and read the same way by the editor, the board,
 * and every export.
 *
 * `config.fit` says whether the picture fills its box and is cropped (cover,
 * the default) or fits whole inside it with the rest left clear (contain).
 * The anchor then says where the cropped or left-over room goes.
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

export type Fit = "contain" | "cover";

export const fitOf = (item: Pick<BoardItem, "config">): Fit =>
  (item.config as { fit?: unknown } | null)?.fit === "contain"
    ? "contain"
    : "cover";

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

const TINT = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

/**
 * A picture recoloured to one colour, keeping its shape (its see-through
 * parts stay see-through): a white mark made blue, a logo in the poster's
 * colour. Null for the picture's own colours.
 */
export const tintOf = (item: Pick<BoardItem, "config">): string | null => {
  const t = (item.config as { tint?: unknown } | null)?.tint;
  return typeof t === "string" && TINT.test(t) ? t : null;
};

/**
 * CSS for a tinted picture: the colour, cut to the picture's shape with a
 * mask, sized and placed the way the picture itself would be.
 */
export const tintCss = (
  url: string,
  tint: string,
  fit: Fit,
  position = "center"
): Record<string, string> => {
  const mask = `url("${url.replaceAll('"', "%22")}") ${position} / ${fit} no-repeat`;
  return {
    "-webkit-mask": mask,
    "background-color": tint,
    mask,
  };
};
