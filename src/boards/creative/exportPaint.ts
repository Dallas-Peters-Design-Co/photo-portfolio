import type { BoardItem } from "../../types";
import { type DrawingConfig, isTransparent } from "../drawing/drawing";
import {
  borderSidesOf,
  borderStrips,
  isPartialBorder,
} from "../drawing/shapePaint";
import { type ShapeGeometry, shapeGeometry } from "../drawing/shapes";
import { anchorFractions, anchorOf, type Fit, fitOf } from "./imageAnchor";

/**
 * Shapes and pictures drawn onto the export's canvas (exportPng.ts): a shape
 * with its colour, Studio picture fill and border, and a picture cropped or
 * tinted as the board shows it.
 */

/**
 * A closed shape's inside: its colour, then its Studio picture (cropped to
 * cover the box) where the shape is.
 */
const paintInside = (
  ctx: CanvasRenderingContext2D,
  area: Path2D,
  config: DrawingConfig,
  picture: HTMLImageElement | undefined,
  w: number,
  h: number
) => {
  if (config.fill && !isTransparent(config.fill)) {
    ctx.fillStyle = config.fill;
    ctx.fill(area);
  }
  if (picture) {
    ctx.save();
    ctx.clip(area);
    drawCover(ctx, picture, w, h);
    ctx.restore();
  }
};

/** A triangle, polygon, star, squircle or line (drawing/shapes.ts). */
const drawPathShape = (
  ctx: CanvasRenderingContext2D,
  shape: ShapeGeometry,
  config: DrawingConfig,
  stroke: number,
  picture: HTMLImageElement | undefined,
  size: { h: number; w: number }
) => {
  const outline = new Path2D(shape.d);
  if (shape.closed) {
    paintInside(ctx, outline, config, picture, size.w, size.h);
  }
  if (stroke > 0 && !isTransparent(config.stroke)) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke;
    ctx.strokeStyle = config.stroke;
    ctx.stroke(outline);
  }
  if (shape.head) {
    ctx.fillStyle = config.stroke;
    ctx.fill(new Path2D(shape.head));
  }
};

/** A picture in one colour: drawn on its own, then filled where it shows. */
export const drawTinted = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  item: BoardItem,
  tint: string
) => {
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.ceil(w));
  layer.height = Math.max(1, Math.ceil(h));
  const g = layer.getContext("2d");
  if (!g) {
    return;
  }
  drawCover(g, img, w, h, anchorFractions(anchorOf(item)), fitOf(item));
  g.globalCompositeOperation = "source-in";
  g.fillStyle = tint;
  g.fillRect(0, 0, layer.width, layer.height);
  ctx.drawImage(layer, 0, 0);
};

/** object-fit cover or contain, as the board draws pictures. */
export const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  /** Where the crop is pinned, 0 to 1 across and down (imageAnchor.ts). */
  at = { x: 0.5, y: 0.5 },
  fit: Fit = "cover"
) => {
  if (fit === "contain") {
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k;
    const dh = img.naturalHeight * k;
    ctx.drawImage(img, (w - dw) * at.x, (h - dh) * at.y, dw, dh);
    return;
  }
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(
    img,
    (img.naturalWidth - sw) * at.x,
    (img.naturalHeight - sh) * at.y,
    sw,
    sh,
    0,
    0,
    w,
    h
  );
};

export const drawShape = (
  ctx: CanvasRenderingContext2D,
  config: DrawingConfig,
  w: number,
  h: number,
  scale: number,
  picture?: HTMLImageElement
) => {
  ctx.globalAlpha = typeof config.opacity === "number" ? config.opacity : 1;
  const stroke = Math.max(0, config.strokeWidth) * scale;
  const shape = shapeGeometry(config, w, h, stroke);
  if (shape) {
    drawPathShape(ctx, shape, config, stroke, picture, { h, w });
    return;
  }
  const path = new Path2D();
  if (config.points && config.points.length > 0) {
    const [first, ...rest] = config.points;
    path.moveTo((first?.x ?? 0) * w, (first?.y ?? 0) * h);
    for (const p of rest) {
      path.lineTo(p.x * w, p.y * h);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke;
    ctx.strokeStyle = config.stroke;
    ctx.stroke(path);
    return;
  }
  // Some sides only: filled to the edges, the border laid inside as bands.
  const partial = isPartialBorder(config);
  const inset = partial ? 0 : stroke / 2;
  const fallback = config.tool === "rounded" ? 18 : 0;
  const radius = Math.min(
    (typeof config.radius === "number" ? config.radius : fallback) * scale,
    w / 2,
    h / 2
  );
  if (config.tool === "ellipse") {
    path.ellipse(
      w / 2,
      h / 2,
      Math.max(w / 2 - inset, 0),
      Math.max(h / 2 - inset, 0),
      0,
      0,
      Math.PI * 2
    );
  } else {
    path.roundRect(
      inset,
      inset,
      Math.max(w - inset * 2, 0),
      Math.max(h - inset * 2, 0),
      radius
    );
  }
  paintInside(ctx, path, config, picture, w, h);
  if (stroke <= 0 || isTransparent(config.stroke)) {
    return;
  }
  if (!partial) {
    ctx.lineWidth = stroke;
    ctx.strokeStyle = config.stroke;
    ctx.stroke(path);
    return;
  }
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = config.stroke;
  for (const s of borderStrips(borderSidesOf(config), w, h, stroke)) {
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  ctx.restore();
};
