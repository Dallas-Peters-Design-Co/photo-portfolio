import { PRINT_DPI, sizeFromTitle } from "../../../config/adLayout";
import {
  apiBase,
  jsonHeaders,
  readPageError,
} from "../../services/portfolioService";
import type { BoardItem } from "../../types";
import { printHtml } from "./printHtml";
import { pdfFrom, sheetPayload } from "./printTransport";

/**
 * A print-ready PDF of a frame, fully vector, with bleed
 * (layers touching the edge run past the trim) and, if asked, crop marks in
 * a margin outside it. The PDF's TrimBox and BleedBox say where the cut and
 * the bleed are, so a print shop's software reads them without being told.
 */

export interface PrintOptions {
  bleed: boolean;
  /** Converted to CMYK after it's printed (io/cmykPdf.ts). */
  cmyk: boolean;
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
 * The print PDF, made on the server: the sheet goes as HTML and comes back
 * as a vector PDF (text stays text, shapes stay paths), with its TrimBox and
 * BleedBox set.
 */
export const exportPrintPdf = async (
  frame: BoardItem,
  layers: BoardItem[],
  textElementFor: (id: string) => HTMLElement | null,
  options: PrintOptions
): Promise<{ blob: Blob; spec: PrintSpec }> => {
  const spec = printSpecFor(frame);
  const layout = {
    bleedIn: options.bleed ? spec.bleedIn : 0,
    heightIn: spec.heightIn,
    marksIn: options.marks ? MARKS_IN : 0,
    widthIn: spec.widthIn,
  };
  const html = await printHtml(frame, layers, textElementFor, layout);
  const res = await fetch(`${apiBase()}/api/boards/print-pdf`, {
    body: JSON.stringify({
      ...layout,
      ...(await sheetPayload(html)),
      origin: window.location.origin,
    }),
    headers: jsonHeaders(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, "Could not make the print PDF"));
  }
  return { blob: await pdfFrom(res), spec };
};
