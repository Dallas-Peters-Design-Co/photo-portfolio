import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";

/**
 * Turning a layer: its stored angle, the CSS for it, and the angle a drag on
 * the rotate handle asks for.
 *
 * A layer's x, y, width and height stay its upright box; the angle turns it
 * about the box's centre when it's drawn, here, on the board and in exports.
 */

export const rotationOf = (item: BoardItem): number =>
  typeof item.rotation === "number" && Number.isFinite(item.rotation)
    ? item.rotation
    : 0;

export const rotateCss = (deg: number): string | undefined =>
  deg ? `rotate(${deg}deg)` : undefined;

/** -180 to 180, to a tenth of a degree, as the server stores it. */
export const normalizeAngle = (deg: number): number => {
  const turned = ((((deg + 180) % 360) + 360) % 360) - 180;
  return Math.round(turned * 10) / 10 || 0;
};

/** The pull towards square angles, in degrees, without Shift. */
const SNAP = 3;

/**
 * The angle for a rotate drag: the change in the pointer's bearing from the
 * centre, added to where the layer started. Shift steps in 15°; otherwise it
 * settles onto 0, 90, 180 and -90 when it comes within a few degrees.
 */
export const dragAngle = (
  center: { x: number; y: number },
  start: { x: number; y: number },
  now: { x: number; y: number },
  origin: number,
  shift: boolean
): number => {
  const bearing = (p: { x: number; y: number }) =>
    (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
  const raw = origin + bearing(now) - bearing(start);
  if (shift) {
    return normalizeAngle(Math.round(raw / 15) * 15);
  }
  const square = Math.round(raw / 90) * 90;
  return normalizeAngle(Math.abs(raw - square) < SNAP ? square : raw);
};

/** A box's centre. */
export const centerOf = (b: Box) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

/**
 * A pointer movement, in the turned layer's own axes: so dragging a side of
 * a turned layer outward makes it bigger, the way the handle points.
 */
export const toLocal = (
  dx: number,
  dy: number,
  deg: number
): { dx: number; dy: number } => {
  if (!deg) {
    return { dx, dy };
  }
  const r = (-deg * Math.PI) / 180;
  return {
    dx: dx * Math.cos(r) - dy * Math.sin(r),
    dy: dx * Math.sin(r) + dy * Math.cos(r),
  };
};
