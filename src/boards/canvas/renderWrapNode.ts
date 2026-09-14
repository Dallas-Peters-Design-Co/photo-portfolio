import { CoverGlError } from "./coverGl";
import { AUTHOR_FACE, TITLE_FACE, wordsFromText } from "./coverLayout";
import { loadImage } from "./halftoneGl";
import { loadFaces, readColor, readText } from "./renderCoverNode";
import {
  backWithBleed,
  frontWithBleed,
  isPaper,
  isTrim,
  pagesFrom,
  px,
  type RectPx,
  SAFE_IN,
  spineWithBleed,
  type WrapSpec,
  wrapSpec,
} from "./wrapLayout";

/**
 * Rendering a Print wrap node to a file.
 *
 * All canvas2d: there is no shader work here, only placing three panels and
 * setting type, and a 3909×2775 2D canvas is nothing a browser minds. The
 * geometry is wrapLayout's; this file only draws what it is told.
 *
 * The output is the print file at 300 dpi, bleed included. It is a picture of
 * the whole sheet, which is what KDP's previewer shows and what the Mockup
 * node can wrap around a book.
 */

export type WrapSettings = Record<string, unknown>;

export interface WrapSources {
  /** Back-cover artwork, if any. */
  back: string | null;
  front: string | null;
  /** Wired copy — a Note, usually — used when the `copy` setting is empty. */
  words: string | null;
}

export const specFrom = (config: WrapSettings): WrapSpec =>
  wrapSpec(
    isTrim(config.trim) ? config.trim : "6x9",
    isPaper(config.paper) ? config.paper : "cream",
    pagesFrom(config.pages)
  );

/** Draws an image covering `box`, cropping whichever axis overflows. */
const drawCover = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: RectPx
): void => {
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.drawImage(
    image,
    box.x + (box.width - w) / 2,
    box.y + (box.height - h) / 2,
    w,
    h
  );
  ctx.restore();
};

/**
 * Word-wraps a paragraph into `width`, returning the lines.
 *
 * Greedy, which is fine for a back cover: three short paragraphs, ragged
 * right. Anything better needs hyphenation and is a typesetting engine.
 */
const wrapLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number
): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width <= width || !line) {
        line = trial;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
};

/**
 * The back cover's copy, set in the live area.
 *
 * A first paragraph that reads as a hook — short, no full stop — is set
 * larger, the rest at reading size. Type sizes are in points at 300 dpi so
 * they mean what a printer means by them: a 12 pt line is 50 px here.
 */
const drawBackCopy = (
  ctx: CanvasRenderingContext2D,
  spec: WrapSpec,
  copy: string,
  ink: string
): void => {
  const safe = spec.backSafe;
  const pt = (points: number) => (points / 72) * 300;
  // Leave the barcode zone alone: copy stops above it.
  const bottom = spec.barcode.y - px(SAFE_IN / 2);
  const width = safe.width;
  let y = safe.y;

  ctx.save();
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";

  const paragraphs = copy
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph, index) => {
    const hook =
      index === 0 && paragraph.length < 120 && !/[.!?]$/.test(paragraph);
    const size = hook ? pt(20) : pt(11.5);
    const leading = size * (hook ? 1.2 : 1.45);
    ctx.font = `${size}px ${hook ? TITLE_FACE : AUTHOR_FACE}`;
    const lines = wrapLines(
      ctx,
      hook ? paragraph.toLocaleUpperCase() : paragraph,
      width
    );
    y += size;
    for (const line of lines) {
      if (y > bottom) {
        break;
      }
      ctx.fillText(line, safe.x, y);
      y += leading;
    }
    y += leading * (hook ? 0.6 : 0.4);
  });
  ctx.restore();
};

/**
 * Spine text, reading top to bottom, the way English-language spines do.
 *
 * Title in the title face, author after it in the byline face, both fitted
 * to the spine's safe width — a spine is the one place the cap height is
 * dictated by the book's thickness rather than by taste.
 */
const drawSpine = (
  ctx: CanvasRenderingContext2D,
  spec: WrapSpec,
  title: string,
  author: string,
  ink: string
): void => {
  if (!(spec.spineTextAllowed && (title || author))) {
    return;
  }
  const safe = spec.spineSafe;
  // Cap height roughly 0.72 em for these faces; keep it inside the safe
  // width with a little air.
  const size = Math.min(px(0.32), (safe.width * 0.7) / 0.72);
  const gap = size * 1.2;

  ctx.save();
  ctx.translate(safe.x + safe.width / 2, safe.y);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";

  ctx.font = `${size}px ${TITLE_FACE}`;
  const titleText = title.toLocaleUpperCase();
  const titleW = ctx.measureText(titleText).width;
  ctx.font = `${size * 0.72}px ${AUTHOR_FACE}`;
  const authorText = author.toLocaleUpperCase();
  const authorW = ctx.measureText(authorText).width;

  const total = titleW + (title && author ? gap : 0) + authorW;
  let x = (safe.height - total) / 2;
  if (title) {
    ctx.font = `${size}px ${TITLE_FACE}`;
    ctx.fillText(titleText, x, 0);
    x += titleW + gap;
  }
  if (author) {
    ctx.font = `${size * 0.72}px ${AUTHOR_FACE}`;
    ctx.fillText(authorText, x, 0);
  }
  ctx.restore();
};

/** Trim, safe and spine lines, for proofing. Never on the upload. */
const drawGuides = (ctx: CanvasRenderingContext2D, spec: WrapSpec): void => {
  const line = (box: RectPx, color: string, dash: number[]) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(dash);
    ctx.strokeRect(box.x + 1.5, box.y + 1.5, box.width - 3, box.height - 3);
    ctx.restore();
  };
  line(spec.back, "#ff3b30", []);
  line(spec.front, "#ff3b30", []);
  line(spec.spine, "#ff3b30", []);
  line(spec.backSafe, "#34c759", [24, 16]);
  line(spec.spineSafe, "#34c759", [24, 16]);
  line(
    {
      height: spec.front.height - px(SAFE_IN) * 2,
      width: spec.front.width - px(SAFE_IN) * 2,
      x: spec.front.x + px(SAFE_IN),
      y: spec.front.y + px(SAFE_IN),
    },
    "#34c759",
    [24, 16]
  );
  line(spec.barcode, "#ffcc00", [12, 8]);
};

export const renderWrap = async (
  config: WrapSettings,
  sources: WrapSources
): Promise<{ blob: Blob; spec: WrapSpec }> => {
  if (!sources.front) {
    throw new CoverGlError("Wire a front cover into this node to make a wrap.");
  }
  const spec = specFrom(config);
  const band = readColor(config.band, "#293341");
  const ink = readColor(config.ink, "#efe6d2");

  const fromWire = wordsFromText(sources.words);
  const title = readText(config.title) || fromWire.title || "";
  const author = readText(config.author) || fromWire.author || "";
  const copy = readText(config.copy) || (sources.words ?? "");

  const [front, back] = await Promise.all([
    loadImage(sources.front),
    sources.back ? loadImage(sources.back) : Promise.resolve(null),
  ]);
  await loadFaces([TITLE_FACE, AUTHOR_FACE]);

  const canvas = document.createElement("canvas");
  canvas.width = spec.canvas.width;
  canvas.height = spec.canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new CoverGlError("This browser cannot draw the wrap.");
  }

  ctx.fillStyle = band;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (back) {
    drawCover(ctx, back, backWithBleed(spec));
  }
  drawCover(ctx, front, frontWithBleed(spec));

  // The spine over both, so a front that bleeds into it does not show.
  const spineBox = spineWithBleed(spec);
  ctx.fillStyle = band;
  ctx.fillRect(spineBox.x, spineBox.y, spineBox.width, spineBox.height);

  if (copy.trim()) {
    drawBackCopy(ctx, spec, copy, ink);
  }
  drawSpine(ctx, spec, title, author, ink);

  if (config.barcode !== "leave") {
    ctx.fillStyle = "#ffffff";
    const b = spec.barcode;
    ctx.fillRect(b.x, b.y, b.width, b.height);
  }
  if (config.guides === "on") {
    drawGuides(ctx, spec);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new CoverGlError("The wrap could not be saved as a picture.");
  }
  return { blob, spec };
};
