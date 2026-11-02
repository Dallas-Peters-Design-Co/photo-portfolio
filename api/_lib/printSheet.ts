import { PDFDocument } from "pdf-lib";
import { launch } from "./screenshot.js";

/**
 * A print-ready sheet as a vector PDF, printed by a real browser.
 *
 * The page arrives as HTML built in the frame editor (src/boards/creative/
 * printHtml.ts): type as live text with its fonts embedded, shapes as paths,
 * pictures as the pictures themselves. Chromium's PDF output keeps all of it
 * that way, so nothing is flattened to pixels the way a canvas export would.
 *
 * Chromium has no idea where a sheet is cut, so the boxes print software
 * reads (TrimBox, BleedBox) are written in afterwards.
 */

export interface SheetSpec {
  bleedIn: number;
  heightIn: number;
  /** The margin outside the bleed that carries the crop marks. */
  marksIn: number;
  widthIn: number;
}

const PT = 72;
const NAV_TIMEOUT_MS = 20_000;
const LOAD_GRACE_MS = 15_000;
/** The largest sheet printed: A0 and 36×48 posters fit. */
const MAX_SIDE_IN = 60;

const finite = (n: unknown, min: number, max: number): number | null =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max
    ? n
    : null;

/** The sheet the request asks for, or null when it isn't a sane one. */
export const sheetSpecFrom = (
  raw: Record<string, unknown>
): SheetSpec | null => {
  const widthIn = finite(raw.widthIn, 0.5, MAX_SIDE_IN);
  const heightIn = finite(raw.heightIn, 0.5, MAX_SIDE_IN);
  const bleedIn = finite(raw.bleedIn ?? 0, 0, 1);
  const marksIn = finite(raw.marksIn ?? 0, 0, 1);
  if (
    widthIn === null ||
    heightIn === null ||
    bleedIn === null ||
    marksIn === null
  ) {
    return null;
  }
  return { bleedIn, heightIn, marksIn, widthIn };
};

/** The whole sheet: trim, bleed both sides, and the marks margin. */
export const sheetSize = (spec: SheetSpec) => ({
  heightIn: spec.heightIn + 2 * (spec.bleedIn + spec.marksIn),
  widthIn: spec.widthIn + 2 * (spec.bleedIn + spec.marksIn),
});

/**
 * TrimBox, BleedBox and CropBox on every page, in points from the sheet's
 * lower left; the boxes are centred, so up and down don't matter.
 */
export const setPrintBoxes = async (
  pdf: Uint8Array,
  spec: SheetSpec
): Promise<Uint8Array> => {
  const doc = await PDFDocument.load(pdf);
  const trimAt = (spec.marksIn + spec.bleedIn) * PT;
  const bleedAt = spec.marksIn * PT;
  for (const page of doc.getPages()) {
    const { width, height } = page.getMediaBox();
    page.setBleedBox(
      bleedAt,
      bleedAt,
      width - 2 * bleedAt,
      height - 2 * bleedAt
    );
    page.setTrimBox(trimAt, trimAt, width - 2 * trimAt, height - 2 * trimAt);
  }
  return doc.save({ useObjectStreams: false });
};

/**
 * Prints the sheet. The page is served at the editor's own origin (the
 * request is answered here, nothing is fetched from the site), so font
 * services that only serve a site's own pages, Adobe Fonts among them,
 * serve this one too.
 */
export const renderSheetPdf = async (
  html: string,
  origin: string,
  spec: SheetSpec
): Promise<Uint8Array> => {
  const sheet = sheetSize(spec);
  const browser = await launch();
  try {
    const page = await browser.newPage({
      viewport: {
        height: Math.round(sheet.heightIn * 96),
        width: Math.round(sheet.widthIn * 96),
      },
    });
    const address = `${origin}/__print-sheet`;
    await page.route(address, (route) =>
      route.fulfill({ body: html, contentType: "text/html; charset=utf-8" })
    );
    await page.goto(address, {
      timeout: NAV_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("networkidle", { timeout: LOAD_GRACE_MS })
      .catch(() => undefined);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) => img.decode().catch(() => undefined))
      );
    });
    const pdf = await page.pdf({
      height: `${sheet.heightIn}in`,
      printBackground: true,
      width: `${sheet.widthIn}in`,
    });
    return setPrintBoxes(pdf, spec);
  } finally {
    await browser.close();
  }
};
