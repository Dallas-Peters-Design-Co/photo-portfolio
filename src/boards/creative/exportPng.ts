import { sizeFromTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import {
  type DrawingConfig,
  isDrawingConfig,
  isTransparent,
} from "../drawing/drawing";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";

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

/** object-fit: cover, as the board draws pictures. */
const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) => {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(
    img,
    (img.naturalWidth - sw) / 2,
    (img.naturalHeight - sh) / 2,
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

const drawText = (
  ctx: CanvasRenderingContext2D,
  item: BoardItem,
  el: HTMLElement | null,
  w: number,
  scale: number
) => {
  if (!el) {
    return;
  }
  const css = getComputedStyle(el);
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
    ctx.fillText(line, x, padTop + i * lineHeight + leading);
  });
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
    const w = item.width * scale;
    const h = item.height * scale;
    ctx.save();
    ctx.translate((item.x - frame.x) * scale, (item.y - frame.y) * scale);
    if (item.kind === "drawing" && isDrawingConfig(item.config)) {
      drawShape(ctx, item.config, w, h, scale);
    } else if (item.kind === "text" || item.kind === "note") {
      drawText(ctx, item, textElementFor(item.id), w, scale);
    } else {
      const picture = pictures.get(currentImageUrl(item) ?? "");
      if (picture) {
        drawCover(ctx, picture, w, h);
      }
    }
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
