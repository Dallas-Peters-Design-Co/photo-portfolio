import { esc, r2 } from "../rng";
import type { StudioValues } from "../types";
import { hexOfOklab, numberOr, rampBetween } from "./liquidColour";
import type { LiquidFrame } from "./liquidGl";

/**
 * The two Liquid looks that need no shader: Aura and Mesh are soft discs of
 * colour, which SVG draws itself with radial gradients and a blur. The file
 * is a few kilobytes at any size, where a picture of the same thing is
 * megabytes, so these never carry a raster.
 *
 * The same geometry is drawn to a 2D canvas for the preview, so what the
 * slider shows is what the file holds.
 *
 * Also here: the adjustment filter (brightness, contrast, saturation, hue)
 * every look wears, written once as SVG and once as the canvas filter string
 * the browser defines in the same terms.
 */

/** How many stops a disc's fade is drawn with. */
const FADE_STOPS = 12;
/** Where the fade is taken to have ended: e^-3.9 is about 2%. */
const FADE_REACH = 3.9;
const TAU = Math.PI * 2;

interface Disc {
  colour: string;
  /** In pixels, from the piece's top left. */
  cx: number;
  cy: number;
  /** Where the fade reaches nothing, in pixels. */
  r: number;
}

/** The discs for this frame at this size, after the orbit and the turn. */
export const discsOf = (
  frame: LiquidFrame,
  width: number,
  height: number
): Disc[] => {
  const unit = height;
  const asp = width / height;
  const k = frame.look === "mesh" ? 2 : 6 - 4.4 * frame.soft;
  const reach = Math.sqrt(FADE_REACH / k);
  const cos = Math.cos(frame.angle);
  const sin = Math.sin(frame.angle);
  return frame.points.map(([x, y, size, start], i) => {
    const swing = (frame.look === "mesh" ? 0.16 : 0.12) * frame.warp;
    const ph = TAU * frame.phase + start;
    const px = (x - 0.5) * asp + swing * Math.cos(ph);
    const py = y - 0.5 + swing * Math.sin(ph);
    return {
      colour: hexOfOklab(frame.colours[i] ?? [0, 0, 0]),
      cx: width / 2 + (px * cos - py * sin) * unit,
      cy: height / 2 + (px * sin + py * cos) * unit,
      r: ((size * reach) / frame.scale) * unit,
    };
  });
};

const FADE_FLOOR = Math.exp(-FADE_REACH);
/**
 * Opacity at `t` (0 centre, 1 edge) of a disc: a Gaussian fade, brought to
 * exactly nothing at the edge so the disc's square shows no seam.
 */
const fadeAt = (t: number) =>
  (Math.exp(-FADE_REACH * t * t) - FADE_FLOOR) / (1 - FADE_FLOOR);

/** The ground the discs sit on: the first colour. */
export const groundOf = (frame: LiquidFrame): string =>
  hexOfOklab(frame.colours[0] ?? [0, 0, 0]);

/** Mesh blurs its discs together; Aura's fade is already soft. */
export const blurOf = (frame: LiquidFrame, height: number): number =>
  frame.look === "mesh" ? (0.01 + 0.05 * frame.soft) * height : 0;

/** Aura lays its lights over the first colour; Mesh is every colour as a disc. */
const shownDiscs = (frame: LiquidFrame, discs: Disc[]) =>
  frame.look === "mesh" ? discs : discs.slice(1);

export const discsSvg = (
  frame: LiquidFrame,
  width: number,
  height: number
): { body: string; defs: string } => {
  const discs = shownDiscs(frame, discsOf(frame, width, height));
  const blur = blurOf(frame, height);
  const m = Math.ceil(blur * 3);
  const defs = discs
    .map(
      (d, i) =>
        `<radialGradient id="d${i}">${Array.from(
          { length: FADE_STOPS },
          (_, k) => {
            const t = k / (FADE_STOPS - 1);
            return `<stop offset="${r2(t * 100)}%" stop-color="${esc(d.colour)}" stop-opacity="${r2(fadeAt(t))}"/>`;
          }
        ).join("")}</radialGradient>`
    )
    .join("");
  const blurDef =
    blur > 0
      ? `<filter id="b" x="${-m}" y="${-m}" width="${width + 2 * m}" height="${height + 2 * m}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${r2(blur)}"/></filter>`
      : "";
  const shapes = discs
    .map(
      (d, i) =>
        `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}" fill="url(#d${i})"/>`
    )
    .join("");
  // The ground runs past the edge so the blur has colour to sample there.
  const ground = `<rect x="${-m}" y="${-m}" width="${width + 2 * m}" height="${height + 2 * m}" fill="${esc(groundOf(frame))}"/>`;
  return {
    body: `<g${blur > 0 ? ' filter="url(#b)"' : ""}>${ground}${shapes}</g>`,
    defs: defs + blurDef,
  };
};

/** The same discs on a canvas, for the live preview. */
export const drawDiscs = (
  g: CanvasRenderingContext2D,
  frame: LiquidFrame
): void => {
  const { height, width } = g.canvas;
  const discs = shownDiscs(frame, discsOf(frame, width, height));
  const blur = blurOf(frame, height);
  g.save();
  g.filter = blur > 0 ? `blur(${blur}px)` : "none";
  g.fillStyle = groundOf(frame);
  g.fillRect(-blur * 3, -blur * 3, width + blur * 6, height + blur * 6);
  for (const d of discs) {
    const fill = g.createRadialGradient(d.cx, d.cy, 0, d.cx, d.cy, d.r);
    for (let k = 0; k < FADE_STOPS; k += 1) {
      const t = k / (FADE_STOPS - 1);
      const alpha = Math.round(fadeAt(t) * 255)
        .toString(16)
        .padStart(2, "0");
      fill.addColorStop(t, `${d.colour}${alpha}`);
    }
    g.fillStyle = fill;
    g.fillRect(d.cx - d.r, d.cy - d.r, d.r * 2, d.r * 2);
  }
  g.restore();
};

/** A ramp through the palette as plain stops, for a browser without WebGL. */
export const rampSvg = (palette: string[], steps = 5): string => {
  const colours =
    palette.length > 1 ? palette : [palette[0] ?? "#000", palette[0] ?? "#000"];
  const stops = colours.flatMap((c, i) => {
    const next = colours[i + 1];
    return next ? rampBetween(c, next, steps).slice(0, steps - 1) : [c];
  });
  return `<linearGradient id="l" x1="0" y1="0" x2="1" y2="1">${stops
    .map(
      (c, i) =>
        `<stop offset="${r2((i / (stops.length - 1)) * 100)}%" stop-color="${esc(c)}"/>`
    )
    .join("")}</linearGradient>`;
};

export interface Adjust {
  /** 1 as is. */
  brightness: number;
  contrast: number;
  /** Degrees. */
  hue: number;
  saturation: number;
}

export const adjustOf = (v: StudioValues): Adjust => ({
  brightness: numberOr(v.brightness, 100) / 100,
  contrast: numberOr(v.contrast, 100) / 100,
  hue: numberOr(v.hue, 0),
  saturation: numberOr(v.saturation, 100) / 100,
});

export const isPlain = (a: Adjust): boolean =>
  a.brightness === 1 && a.contrast === 1 && a.saturation === 1 && a.hue === 0;

/**
 * The adjustments as the canvas filter string. The browser defines each of
 * these functions as the SVG primitives `adjustSvg` writes, so the two match.
 */
export const adjustCss = (a: Adjust): string =>
  isPlain(a)
    ? "none"
    : `brightness(${r2(a.brightness)}) contrast(${r2(a.contrast)}) saturate(${r2(a.saturation)}) hue-rotate(${r2(a.hue)}deg)`;

const linearFuncs = (slope: number, intercept: number) =>
  ["R", "G", "B"]
    .map(
      (c) =>
        `<feFunc${c} type="linear" slope="${r2(slope)}" intercept="${r2(intercept)}"/>`
    )
    .join("");

/** The adjustments as an SVG filter (`#a`), or nothing when all are as is. */
export const adjustSvg = (a: Adjust): string =>
  isPlain(a)
    ? ""
    : `<filter id="a" color-interpolation-filters="sRGB"><feComponentTransfer>${linearFuncs(a.brightness, 0)}</feComponentTransfer><feComponentTransfer>${linearFuncs(a.contrast, 0.5 - 0.5 * a.contrast)}</feComponentTransfer><feColorMatrix type="saturate" values="${r2(a.saturation)}"/><feColorMatrix type="hueRotate" values="${r2(a.hue)}"/></filter>`;
