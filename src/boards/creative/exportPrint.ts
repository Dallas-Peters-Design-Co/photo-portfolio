import { PRINT_DPI, sizeFromTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import { printPdf } from "../io/printPdf";
import { renderCreative } from "./exportPng";

/**
 * A print-ready PDF of a frame: the design at print resolution, with bleed
 * (layers touching the edge run past the trim) and, if asked, crop marks in
 * a margin outside it. The PDF's TrimBox and BleedBox say where the cut and
 * the bleed are, so a print shop's software reads them without being told.
 */

export interface PrintOptions {
  bleed: boolean;
  marks: boolean;
}

export interface PrintSpec {
  bleedIn: number;
  heightIn: number;
  widthIn: number;
}

/** US sizes bleed an eighth of an inch; A sizes the usual 3 mm. */
const US_BLEED = 0.125;
const ISO_BLEED = 3 / 25.4;
const MARKS_IN = 0.25;
const ISO_SIZE = /\bA\d\b/;
/** Pixels a browser canvas reliably takes in one piece, with room to spare. */
const MAX_PIXELS = 40_000_000;

/** The trim size in inches, read from the frame's print size (300 dpi). */
export const printSpecFor = (frame: BoardItem): PrintSpec => {
  const px = sizeFromTitle(frame.body) ?? {
    h: frame.height * 2,
    w: frame.width * 2,
  };
  const iso = ISO_SIZE.test(frame.body ?? "");
  return {
    bleedIn: iso ? ISO_BLEED : US_BLEED,
    heightIn: px.h / PRINT_DPI,
    widthIn: px.w / PRINT_DPI,
  };
};

/**
 * The resolutions to try, best first: 300 dpi where the sheet fits in a
 * canvas, otherwise the most that does. A 24×36 poster lands near 200, which
 * is plenty at the distance a poster is read from.
 */
export const dpiLadder = (spec: PrintSpec, bleed: boolean): number[] => {
  const extra = bleed ? spec.bleedIn * 2 : 0;
  const area = (spec.widthIn + extra) * (spec.heightIn + extra);
  const most = Math.min(PRINT_DPI, Math.floor(Math.sqrt(MAX_PIXELS / area)));
  return [most, 200, 150, 100].filter(
    (dpi, i, all) => dpi <= most && all.indexOf(dpi) === i
  );
};

export const exportPrintPdf = async (
  frame: BoardItem,
  layers: BoardItem[],
  textElementFor: (id: string) => HTMLElement | null,
  options: PrintOptions
): Promise<{ blob: Blob; dpi: number; spec: PrintSpec }> => {
  const spec = printSpecFor(frame);
  const bleedIn = options.bleed ? spec.bleedIn : 0;
  let failure: unknown = null;
  for (const dpi of dpiLadder(spec, options.bleed)) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: each step down only runs when the one before failed
      const png = await renderCreative(
        frame,
        layers,
        Math.round(spec.widthIn * dpi),
        textElementFor,
        "#ffffff",
        Math.round(bleedIn * dpi)
      );
      const blob = await printPdf(png, {
        bleedIn,
        heightIn: spec.heightIn + bleedIn * 2,
        marksIn: options.marks ? MARKS_IN : 0,
        widthIn: spec.widthIn + bleedIn * 2,
      });
      return { blob, dpi, spec };
    } catch (e) {
      // Too big for this browser's canvas: try the next resolution down.
      failure = e;
    }
  }
  throw failure instanceof Error
    ? failure
    : new Error("This design is too large to export here");
};
