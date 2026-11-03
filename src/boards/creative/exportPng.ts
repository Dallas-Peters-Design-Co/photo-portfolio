import { sizeFromTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import {
  type DrawingConfig,
  isDrawingConfig,
  isTransparent,
} from "../drawing/drawing";
import { type ShapeGeometry, shapeGeometry } from "../drawing/shapes";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import { anchorFractions, anchorOf, type Fit, fitOf } from "./imageAnchor";
import { imageRadius } from "./imageRadius";
import { layerOpacity } from "./layerOpacity";
import { rotationOf } from "./rotate";

/**
 * A frame's design, drawn to a PNG at its real pixel size.
 *
 * Drawn layer by layer onto a canvas rather than screenshotting the DOM, so
 * the result is the ad's own resolution (1080×1920 for a Story frame) however
 * small it looks on screen. Text takes its colour, font and padding from the
 * element the editor rendered, so what exports is what was on screen.
 */

/** Pixel width to export at: the size in the frame's name, else 2× the frame. */
export const exportWidthFor = (frame: BoardItem): number =>
  sizeFromTitle(frame.body)?.w ?? Math.round(frame.width * 2);

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${url}`));
    img.src = url;
  });

/** A triangle, polygon, star, squircle or line (drawing/shapes.ts). */
const drawPathShape = (
  ctx: CanvasRenderingContext2D,
  shape: ShapeGeometry,
  config: DrawingConfig,
  stroke: number
) => {
  const outline = new Path2D(shape.d);
  if (shape.closed && config.fill && !isTransparent(config.fill)) {
    ctx.fillStyle = config.fill;
    ctx.fill(outline);
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

/** object-fit cover or contain, as the board draws pictures. */
const drawCover = (
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

const drawShape = (
  ctx: CanvasRenderingContext2D,
  config: DrawingConfig,
  w: number,
  h: number,
  scale: number
) => {
  ctx.globalAlpha = typeof config.opacity === "number" ? config.opacity : 1;
  const stroke = Math.max(0, config.strokeWidth) * scale;
  const shape = shapeGeometry(config, w, h, stroke);
  if (shape) {
    drawPathShape(ctx, shape, config, stroke);
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
  const inset = stroke / 2;
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
    const fallback = config.tool === "rounded" ? 18 : 0;
    const radius =
      (typeof config.radius === "number" ? config.radius : fallback) * scale;
    path.roundRect(
      inset,
      inset,
      Math.max(w - stroke, 0),
      Math.max(h - stroke, 0),
      Math.min(radius, w / 2, h / 2)
    );
  }
  if (!isTransparent(config.fill) && config.fill) {
    ctx.fillStyle = config.fill;
    ctx.fill(path);
  }
  if (stroke > 0 && !isTransparent(config.stroke)) {
    ctx.lineWidth = stroke;
    ctx.strokeStyle = config.stroke;
    ctx.stroke(path);
  }
};

const SPACES = /(\s+)/;

const wrap = (
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number
): string[] =>
  text.split("\n").flatMap((paragraph) => {
    const words = paragraph.split(SPACES);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line + word;
      if (line && ctx.measureText(next.trimEnd()).width > width) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }
    lines.push(line.trimEnd());
    return lines;
  });

const TRANSFORMS: Record<string, (s: string) => string> = {
  capitalize: (s) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
  lowercase: (s) => s.toLowerCase(),
  uppercase: (s) => s.toUpperCase(),
};

const CLEAR = new Set(["", "transparent", "rgba(0, 0, 0, 0)"]);

/** The box behind text, filling the layer's own box. */
const drawTextBox = (
  ctx: CanvasRenderingContext2D,
  css: CSSStyleDeclaration,
  w: number,
  h: number,
  scale: number
) => {
  if (CLEAR.has(css.backgroundColor)) {
    return;
  }
  const radius = (Number.parseFloat(css.borderTopLeftRadius) || 0) * scale;
  const box = new Path2D();
  box.roundRect(0, 0, w, h, Math.min(radius, w / 2, h / 2));
  ctx.fillStyle = css.backgroundColor;
  ctx.fill(box);
};

/** The outline's width and colour, or null when the text has none. */
const outlineOf = (css: CSSStyleDeclaration, scale: number) => {
  const width =
    Number.parseFloat(css.getPropertyValue("-webkit-text-stroke-width")) *
    scale;
  const color = css.getPropertyValue("-webkit-text-stroke-color");
  return width > 0 && !CLEAR.has(color) ? { color, width } : null;
};

const drawText = (
  ctx: CanvasRenderingContext2D,
  item: BoardItem,
  el: HTMLElement | null,
  w: number,
  h: number,
  scale: number
) => {
  if (!el) {
    return;
  }
  const css = getComputedStyle(el);
  drawTextBox(ctx, css, w, h, scale);
  const outline = outlineOf(css, scale);
  const size = Number.parseFloat(css.fontSize) * scale;
  const font = `${css.fontStyle} ${css.fontWeight} ${size}px ${css.fontFamily}`;
  ctx.font = font;
  ctx.fillStyle = css.color;
  ctx.textBaseline = "top";
  ctx.fontKerning = css.fontKerning === "none" ? "none" : "normal";
  const tracking = Number.parseFloat(css.letterSpacing);
  if ("letterSpacing" in ctx && Number.isFinite(tracking)) {
    (
      ctx as CanvasRenderingContext2D & { letterSpacing: string }
    ).letterSpacing = `${tracking * scale}px`;
  }
  const pad = Number.parseFloat(css.paddingLeft) * scale || 0;
  const padTop = Number.parseFloat(css.paddingTop) * scale || 0;
  const lineHeight =
    css.lineHeight === "normal"
      ? size * 1.25
      : Number.parseFloat(css.lineHeight) * scale;
  const body = (TRANSFORMS[css.textTransform] ?? ((s: string) => s))(
    item.body ?? ""
  );
  const inner = Math.max(1, w - pad * 2);
  const align = css.textAlign;
  const side = align === "right" || align === "end" ? "right" : "left";
  ctx.textAlign = align === "center" ? "center" : side;
  const edge = side === "right" ? w - pad : pad;
  const x = align === "center" ? w / 2 : edge;
  // Half-leading, as CSS centres the glyphs in the line box.
  const leading = (lineHeight - size) / 2;
  wrap(ctx, body, inner).forEach((line, i) => {
    const y = padTop + i * lineHeight + leading;
    if (outline) {
      // Under the fill, as paint-order draws it on the page.
      ctx.lineJoin = "round";
      ctx.lineWidth = outline.width;
      ctx.strokeStyle = outline.color;
      ctx.strokeText(line, x, y);
      ctx.fillStyle = css.color;
    }
    ctx.fillText(line, x, y);
  });
};

/**
 * A layer's box for print, in frame units: grown out past every frame edge it
 * touches by the bleed, so a background, a full-bleed picture or a band of
 * colour runs off the trim instead of stopping at it and leaving a white
 * sliver when the cut wanders. A turned layer keeps its box.
 */
export const bleedBox = (
  item: Box & { rotation?: number | null },
  frame: Box,
  bleed: number
): Box => {
  if (bleed <= 0 || rotationOf(item as BoardItem)) {
    return { height: item.height, width: item.width, x: item.x, y: item.y };
  }
  const EDGE = 0.5;
  const left = item.x <= frame.x + EDGE ? bleed : 0;
  const top = item.y <= frame.y + EDGE ? bleed : 0;
  const right = item.x + item.width >= frame.x + frame.width - EDGE ? bleed : 0;
  const bottom =
    item.y + item.height >= frame.y + frame.height - EDGE ? bleed : 0;
  return {
    height: item.height + top + bottom,
    width: item.width + left + right,
    x: item.x - left,
    y: item.y - top,
  };
};

/** The drawing tools that make a box, which can grow without changing shape. */
const BOX_TOOLS = new Set(["rect", "rounded", "squircle"]);

/**
 * Whether a layer runs into the bleed when it touches the edge: pictures and
 * box-shaped fills do. Words never should, and a circle or star would only be
 * stretched out of shape.
 */
export const bleeds = (item: BoardItem): boolean => {
  if (item.kind === "drawing") {
    return isDrawingConfig(item.config) && BOX_TOOLS.has(item.config.tool);
  }
  // A fitted (contain) picture keeps its own size; growing its box into the
  // bleed would only move it.
  return (
    item.kind !== "text" && item.kind !== "note" && fitOf(item) === "cover"
  );
};

/** One layer, drawn in place: the caller saves and restores the context. */
const drawLayer = (
  ctx: CanvasRenderingContext2D,
  item: BoardItem,
  frame: Box,
  scale: number,
  pictures: Map<string, HTMLImageElement>,
  textElementFor: (id: string) => HTMLElement | null
) => {
  const w = item.width * scale;
  const h = item.height * scale;
  ctx.translate((item.x - frame.x) * scale, (item.y - frame.y) * scale);
  const turn = rotationOf(item);
  if (turn) {
    // About the layer's centre, as it turns in the editor.
    ctx.translate(w / 2, h / 2);
    ctx.rotate((turn * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
  }
  ctx.globalAlpha = layerOpacity(item);
  if (item.kind === "drawing" && isDrawingConfig(item.config)) {
    drawShape(ctx, item.config, w, h, scale);
  } else if (item.kind === "text" || item.kind === "note") {
    drawText(ctx, item, textElementFor(item.id), w, h, scale);
  } else {
    const picture = pictures.get(currentImageUrl(item) ?? "");
    if (picture) {
      const radius = imageRadius(item) * scale;
      if (radius > 0) {
        const clip = new Path2D();
        clip.roundRect(0, 0, w, h, Math.min(radius, w / 2, h / 2));
        ctx.clip(clip);
      }
      drawCover(
        ctx,
        picture,
        w,
        h,
        anchorFractions(anchorOf(item)),
        fitOf(item)
      );
    }
  }
};

export const renderCreative = async (
  frame: Box,
  layers: BoardItem[],
  pxWidth: number,
  textElementFor: (id: string) => HTMLElement | null,
  background: string | null = null
): Promise<Blob> => {
  const scale = pxWidth / frame.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(frame.width * scale);
  canvas.height = Math.round(frame.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("This browser can't draw the export");
  }
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Pictures first, all at once, so the layers can then be drawn in order.
  const pictures = new Map(
    await Promise.all(
      layers
        .map((item) => currentImageUrl(item))
        .filter((url): url is string => Boolean(url))
        .map(async (url) => [url, await loadImage(url)] as const)
    )
  );
  const fonts = layers
    .filter((item) => item.kind === "text" || item.kind === "note")
    .map((item) => textElementFor(item.id))
    .filter((el): el is HTMLElement => el !== null)
    .map((el) => {
      const css = getComputedStyle(el);
      return document.fonts
        .load(`${css.fontStyle} ${css.fontWeight} 32px ${css.fontFamily}`)
        .catch(() => undefined);
    });
  await Promise.all(fonts);
  for (const item of layers) {
    ctx.save();
    drawLayer(ctx, item, frame, scale, pictures, textElementFor);
    ctx.restore();
  }
  return await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("The export came out empty")),
        "image/png"
      );
    } catch {
      reject(
        new Error(
          "An image on this design doesn't allow exporting. Replace it with an uploaded copy."
        )
      );
    }
  });
};

export const downloadBlob = (blob: Blob, name: string, ext = "png") => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-")}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
