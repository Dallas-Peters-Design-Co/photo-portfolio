import type { DrawingConfig } from "./drawing";

/**
 * What a shape is painted with beyond a flat colour: a border on only some
 * of its sides, and a picture from the Studio as its fill.
 *
 * Kept apart from drawing.ts and shared, because the board and editor (SVG),
 * the PNG export (canvas) and the HTML5 export (HTML) each draw shapes on
 * their own, and three readings of "which sides" would draw three shapes.
 *
 * A border always sits inside the shape's box, like CSS's border-box: giving
 * a banner's background a 24-unit bottom border never makes the shape any
 * bigger, so it can't push past its frame the way a separate bar could.
 */

export const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;
export type BorderSide = (typeof BORDER_SIDES)[number];

/** The shapes a border can run along only some sides of. */
export const isBoxTool = (tool: string | undefined): boolean =>
  tool === "rect" || tool === "rounded";

/** The sides the border runs along. Absent, or anything but a box: all four. */
export const borderSidesOf = (
  config: Pick<DrawingConfig, "borderSides" | "tool">
): BorderSide[] => {
  if (!(isBoxTool(config.tool) && Array.isArray(config.borderSides))) {
    return [...BORDER_SIDES];
  }
  return BORDER_SIDES.filter((s) => config.borderSides?.includes(s));
};

/** True when a box's border runs along some sides and not others. */
export const isPartialBorder = (
  config: Pick<DrawingConfig, "borderSides" | "tool">
): boolean => borderSidesOf(config).length < BORDER_SIDES.length;

export interface Strip {
  h: number;
  w: number;
  x: number;
  y: number;
}

/** The border as bands just inside the box's edges, one per side. */
export const borderStrips = (
  sides: BorderSide[],
  w: number,
  h: number,
  width: number
): Strip[] => {
  const t = Math.min(width, w, h);
  const at: Record<BorderSide, Strip> = {
    bottom: { h: t, w, x: 0, y: h - t },
    left: { h, w: t, x: 0, y: 0 },
    right: { h, w: t, x: w - t, y: 0 },
    top: { h: t, w, x: 0, y: 0 },
  };
  return t > 0 ? sides.map((s) => at[s]) : [];
};

/** The Studio picture a shape is filled with, if it has one. */
export const fillImageOf = (config: unknown): string | null => {
  const url = (config as { fillImage?: unknown } | null)?.fillImage;
  return typeof url === "string" && url.length > 0 ? url : null;
};
