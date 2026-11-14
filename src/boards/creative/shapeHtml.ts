import { type DrawingConfig, isTransparent } from "../drawing/drawing";
import {
  type BorderSide,
  borderSidesOf,
  fillImageOf,
  isPartialBorder,
} from "../drawing/shapePaint";
import { type ShapeGeometry, shapeGeometry } from "../drawing/shapes";
import { escapeHtml, px, styleOf } from "./htmlBits";

/**
 * A shape layer as HTML for the HTML5 ad (exportHtml5.ts): a box as a styled
 * div, anything else as SVG. A Studio picture fill comes from the zip when
 * it was copied in (images), else from its address.
 */

/** A triangle, polygon, star, squircle or line (drawing/shapes.ts) as SVG. */
const pathShapeHtml = (
  shape: ShapeGeometry,
  config: DrawingConfig,
  place: Record<string, string | null>,
  stroke: number,
  picture: string | null
): string => {
  const w = Number.parseFloat(place.width ?? "0");
  const h = Number.parseFloat(place.height ?? "0");
  const fill =
    shape.closed && config.fill && !isTransparent(config.fill)
      ? escapeHtml(config.fill)
      : "none";
  const line = stroke > 0 ? escapeHtml(config.stroke) : "none";
  const head = shape.head
    ? `<path d="${shape.head}" fill="${escapeHtml(config.stroke)}"/>`
    : "";
  // A Studio picture: a pattern covering the box, painted over the colour.
  const id = `fill-${Math.random().toString(36).slice(2, 9)}`;
  const art =
    picture && shape.closed
      ? `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><image href="${escapeHtml(picture)}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/></pattern></defs><path d="${shape.d}" fill="${fill}"/>`
      : "";
  const top = art ? `url(#${id})` : fill;
  return `<svg style="${styleOf({ ...place, overflow: "visible" })}" viewBox="0 0 ${w} ${h}">${art}<path d="${shape.d}" fill="${top}" stroke="${line}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>${head}</svg>`;
};

/** A box's border as inset shadows: all round, or one per side it runs along. */
const borderShadow = (config: DrawingConfig, stroke: number): string | null => {
  if (stroke <= 0 || isTransparent(config.stroke)) {
    return null;
  }
  const w = px(stroke);
  const offsets: Record<BorderSide, string> = {
    bottom: `0 -${w}`,
    left: `${w} 0`,
    right: `-${w} 0`,
    top: `0 ${w}`,
  };
  return isPartialBorder(config)
    ? borderSidesOf(config)
        .map((side) => `inset ${offsets[side]} 0 0 ${config.stroke}`)
        .join(", ") || null
    : `inset 0 0 0 ${w} ${config.stroke}`;
};

export const shapeHtml = (
  config: DrawingConfig,
  place: Record<string, string>,
  scale: number,
  images: Map<string, string> = new Map()
): string => {
  const opacity =
    typeof config.opacity === "number" && config.opacity < 1
      ? `${config.opacity}`
      : null;
  const stroke = Math.max(0, config.strokeWidth) * scale;
  const url = fillImageOf(config);
  const picture = url ? (images.get(url) ?? url) : null;
  const shape = shapeGeometry(
    config,
    Number.parseFloat(place.width),
    Number.parseFloat(place.height),
    stroke
  );
  if (shape) {
    return pathShapeHtml(shape, config, { ...place, opacity }, stroke, picture);
  }
  if (config.points && config.points.length > 0) {
    // Freehand: unit-space points stretched across the box, as on the board.
    const points = config.points.map((p) => `${p.x},${p.y}`).join(" ");
    return `<svg style="${styleOf({ ...place, opacity, overflow: "visible" })}" viewBox="0 0 1 1" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="${escapeHtml(config.stroke)}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const fallback = config.tool === "rounded" ? 18 : 0;
  const radius =
    config.tool === "ellipse"
      ? "50%"
      : px(
          (typeof config.radius === "number" ? config.radius : fallback) * scale
        );
  return `<div style="${escapeHtml(
    styleOf({
      ...place,
      background:
        config.fill && !isTransparent(config.fill) ? config.fill : null,
      "background-image": picture ? `url('${picture}')` : null,
      "background-position": picture ? "center" : null,
      "background-size": picture ? "cover" : null,
      "border-radius": radius === "0px" ? null : radius,
      "box-shadow": borderShadow(config, stroke),
      opacity,
    })
  )}"></div>`;
};
