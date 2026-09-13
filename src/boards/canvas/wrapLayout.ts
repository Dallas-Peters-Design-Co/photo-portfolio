/**
 * A print cover's geometry, as KDP wants it.
 *
 * Pure and DOM-free like coverLayout.ts, and for the same reason: this is the
 * arithmetic that decides whether the spine lands on the spine, and it is the
 * one mistake on a cover that costs a reprint. It can be tested without a
 * canvas, so it is.
 *
 * Everything is in inches until the last step, because that is how KDP's own
 * calculator states it, and a spec that reads "0.78 in" can be checked against
 * theirs by eye. `px` rounds to whole pixels at 300 dpi at the end.
 *
 * The numbers are KDP's published ones (paperback, as of the print-cover
 * calculator): bleed 0.125", live area 0.25" off any trimmed edge, spine text
 * only at 79 pages and up, and a barcode zone of 2" × 1.2" in the lower right
 * of the back which KDP overprints whether or not something is there.
 */

export const DPI = 300;
export const BLEED_IN = 0.125;
/** Keep live copy at least this far off any trimmed edge. */
export const SAFE_IN = 0.25;
/** KDP's margin either side of spine text, inside the spine. */
export const SPINE_SAFE_IN = 0.0625;
export const BARCODE_IN = { height: 1.2, width: 2 } as const;
/** Under this KDP asks for a blank spine: too narrow to hold a line of type. */
export const SPINE_TEXT_MIN_PAGES = 79;

/** Inches per page, by KDP paper stock. */
export const PAPER_THICKNESS_IN = {
  "color-premium": 0.002252,
  "color-standard": 0.0032,
  cream: 0.0025,
  white: 0.002252,
} as const;

export type Paper = keyof typeof PAPER_THICKNESS_IN;

/** Trim sizes as width × height in inches. The ones KDP lists for trade books. */
export const TRIMS = {
  "5x8": [5, 8],
  "5.25x8": [5.25, 8],
  "5.5x8.5": [5.5, 8.5],
  "6x9": [6, 9],
} as const;

export type Trim = keyof typeof TRIMS;

export const isPaper = (value: unknown): value is Paper =>
  typeof value === "string" && Object.hasOwn(PAPER_THICKNESS_IN, value);

export const isTrim = (value: unknown): value is Trim =>
  typeof value === "string" && Object.hasOwn(TRIMS, value);

export interface RectPx {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface WrapSpec {
  /** Where KDP will print the barcode; keep it clear. Inside the back's trim. */
  barcode: RectPx;
  /** The back panel, trim only (bleed lies outside it). */
  back: RectPx;
  /** The back's live area — where copy may go. */
  backSafe: RectPx;
  bleedPx: number;
  /** The whole file, bleed included. */
  canvas: { height: number; width: number };
  canvasIn: { height: number; width: number };
  /** The front panel, trim only. */
  front: RectPx;
  pages: number;
  paper: Paper;
  /** The spine, full height of the trim. */
  spine: RectPx;
  spineIn: number;
  /** Inside the spine, with KDP's margin taken off both sides. */
  spineSafe: RectPx;
  /** False under 79 pages: KDP wants the spine blank. */
  spineTextAllowed: boolean;
  trim: Trim;
  trimIn: { height: number; width: number };
}

export const px = (inches: number): number => Math.round(inches * DPI);

/**
 * The wrap for a book.
 *
 * `pages` is the interior page count KDP will print, which is the number the
 * manuscript's PDF has — not the chapter count, and not "about 300".
 */
export const wrapSpec = (
  trim: Trim,
  paper: Paper,
  pages: number
): WrapSpec => {
  const [tw, th] = TRIMS[trim];
  const count = Math.max(24, Math.min(828, Math.round(pages)));
  const spineIn = count * PAPER_THICKNESS_IN[paper];

  const widthIn = tw * 2 + spineIn + BLEED_IN * 2;
  const heightIn = th + BLEED_IN * 2;

  const bleed = px(BLEED_IN);
  const trimW = px(tw);
  const trimH = px(th);
  const spineW = px(spineIn);
  const spineSafe = px(SPINE_SAFE_IN);
  const safe = px(SAFE_IN);

  const back: RectPx = { height: trimH, width: trimW, x: bleed, y: bleed };
  const spine: RectPx = {
    height: trimH,
    width: spineW,
    x: bleed + trimW,
    y: bleed,
  };
  const front: RectPx = {
    height: trimH,
    width: trimW,
    x: bleed + trimW + spineW,
    y: bleed,
  };

  const barcodeW = px(BARCODE_IN.width);
  const barcodeH = px(BARCODE_IN.height);

  return {
    back,
    backSafe: {
      height: trimH - safe * 2,
      width: trimW - safe * 2,
      x: back.x + safe,
      y: back.y + safe,
    },
    // KDP places it in the lower right of the back cover, inset by the live
    // margin. Anything under it is lost.
    barcode: {
      height: barcodeH,
      width: barcodeW,
      x: back.x + trimW - safe - barcodeW,
      y: back.y + trimH - safe - barcodeH,
    },
    bleedPx: bleed,
    // Summed from the rounded parts rather than rounded from the inches, so
    // the panels tile the sheet exactly: 0.125" is 37.5 px, and rounding the
    // whole and the parts separately left a one-pixel seam.
    canvas: {
      height: trimH + bleed * 2,
      width: trimW * 2 + spineW + bleed * 2,
    },
    canvasIn: { height: heightIn, width: widthIn },
    front,
    pages: count,
    paper,
    spine,
    spineIn,
    spineSafe: {
      height: trimH - safe * 2,
      width: Math.max(0, spineW - spineSafe * 2),
      x: spine.x + spineSafe,
      y: spine.y + safe,
    },
    spineTextAllowed: count >= SPINE_TEXT_MIN_PAGES,
    trim,
    trimIn: { height: th, width: tw },
  };
};

/**
 * Where a front cover drawn at trim size goes on the wrap, bleed included.
 *
 * The front's artwork has to run past the trim on its three outer edges — top,
 * right, bottom — or a cutter that drifts a hair leaves a white sliver. The
 * cover file is drawn at the trim, so it is stretched outward by one bleed on
 * each of those edges; on the inside edge it meets the spine and needs none.
 *
 * Stretching by one bleed on a 6" cover is 2%, and it is uniform, so nothing
 * on the cover visibly changes shape. Cropping instead would lose a slice of
 * the title band.
 */
export const frontWithBleed = (spec: WrapSpec): RectPx => ({
  height: spec.front.height + spec.bleedPx * 2,
  width: spec.front.width + spec.bleedPx,
  x: spec.front.x,
  y: spec.front.y - spec.bleedPx,
});

/** The same for the back, which bleeds top, left and bottom. */
export const backWithBleed = (spec: WrapSpec): RectPx => ({
  height: spec.back.height + spec.bleedPx * 2,
  width: spec.back.width + spec.bleedPx,
  x: spec.back.x - spec.bleedPx,
  y: spec.back.y - spec.bleedPx,
});

/** The spine, bleeding top and bottom. */
export const spineWithBleed = (spec: WrapSpec): RectPx => ({
  height: spec.spine.height + spec.bleedPx * 2,
  width: spec.spine.width,
  x: spec.spine.x,
  y: spec.spine.y - spec.bleedPx,
});

/**
 * A page count from whatever the setting holds.
 *
 * Text rather than a number setting on the node, so a wired Note can carry
 * it, and so "312" pasted from the manuscript's page count works without the
 * field first being clicked into. Anything unreadable falls back to a length
 * that gives a spine wide enough to type on, so a first render never comes
 * out blank-spined for want of a number.
 */
export const pagesFrom = (value: unknown, fallback = 300): number => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.replace(/[^\d]/g, ""), 10)
        : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
