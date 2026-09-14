import ImageTracer, {
  type ImageTracerOptions,
} from "../../vendor/imagetracer.js";
import { loadImage } from "./halftoneGl";

/**
 * Rendering a Trace node to an SVG file.
 *
 * imagetracer.js (src/vendor) does the work: quantise the pixels to a
 * palette, find the region of each colour, fit lines and quadratic curves
 * to its edges, write a <path> per region. This file reads the settings,
 * sizes the picture, and puts the tracer's coordinates back at the
 * picture's own scale so the SVG is the size the picture was.
 *
 * Synchronous and on the main thread. A 1400-pixel trace at 32 colours is
 * one to three seconds, which the flush's toast covers; a worker would be
 * the next step if this ever traces a batch of twenty.
 */

export type TraceSettings = Record<string, unknown>;

export class TraceError extends Error {}

const number = (value: unknown, fallback: number, min: number, max: number) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/**
 * The tracer's dials for each Detail choice.
 *
 * ltres and qtres are the error a fitted line or curve may have, in pixels
 * of the traced image; pathomit drops small paths. "Sharp" turns the
 * right-angle enhancer off because it rounds the corners of halftone dots
 * into blobs, which is the opposite of sharp.
 */
const DETAIL: Record<string, ImageTracerOptions> = {
  balanced: { ltres: 1, qtres: 1, rightangleenhance: true },
  sharp: { ltres: 0.3, qtres: 0.3, rightangleenhance: false, roundcoords: 2 },
  smooth: { ltres: 2, qtres: 2, rightangleenhance: true },
};

export const traceOptionsFrom = (config: TraceSettings): ImageTracerOptions => {
  const detail =
    typeof config.detail === "string" && config.detail in DETAIL
      ? DETAIL[config.detail]
      : DETAIL.balanced;
  return {
    ...detail,
    blurdelta: 64,
    blurradius: number(config.blur, 0, 0, 5),
    colorquantcycles: 3,
    // Deterministic sampling: the same picture traces the same way twice,
    // which is what "re-run to pick up a setting change" relies on.
    colorsampling: 2,
    layering: config.layering === "cutout" ? 1 : 0,
    numberofcolors: Math.round(number(config.colors, 32, 2, 256)),
    pathomit: Math.round(number(config.speckle, 8, 0, 64)),
    roundcoords: detail.roundcoords ?? 1,
    strokewidth: 0,
    viewbox: true,
  };
};

/** The picture's pixels at the trace size. */
const pixelsOf = (image: HTMLImageElement, longest: number): ImageData => {
  const scale = Math.min(
    1,
    longest / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new TraceError("This browser cannot read the picture back.");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
};

/**
 * Puts the SVG at the picture's own size.
 *
 * With `viewbox` on, the tracer writes a viewBox at the traced size and no
 * width or height. The viewBox stays — the path coordinates are in that
 * space — and the original's width and height go on the root, so the file
 * opens at the right dimensions and scales its content to fit.
 */
const atOriginalSize = (svg: string, width: number, height: number): string =>
  svg.replace(/^<svg /, `<svg width="${width}" height="${height}" `);

export const renderTrace = async (
  config: TraceSettings,
  imageUrl: string | null
): Promise<Blob> => {
  if (!imageUrl) {
    throw new TraceError("Wire a picture into this node to trace it.");
  }
  const image = await loadImage(imageUrl);
  const longest = Math.round(number(config.size, 1400, 400, 2700));
  const pixels = pixelsOf(image, longest);
  const svg = ImageTracer.imagedataToSVG(pixels, traceOptionsFrom(config));
  if (!svg.includes("<path")) {
    throw new TraceError(
      "Nothing traced — the picture may be one flat colour."
    );
  }
  const sized = atOriginalSize(svg, image.naturalWidth, image.naturalHeight);
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${sized}`], {
    type: "image/svg+xml",
  });
};
