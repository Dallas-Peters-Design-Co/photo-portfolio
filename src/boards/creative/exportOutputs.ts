import { groupFromTitle } from "../../../config/adLayout";
import { zip } from "../../lib/zip";
import type { BoardItem } from "../../types";
import { jpegPage, type PdfPage, slidesPdf } from "../io/slidesPdf";
import { layersOf } from "./creativeModel";
import { escapeHtml } from "./exportHtml5";
import { exportWidthFor, renderCreative } from "./exportPng";
import { withTextGhosts } from "./textGhosts";

/**
 * Exports for the frames that aren't ads: an email, and a deck of slides.
 * (A landing hero is the HTML5 page with no clickTag; see exportHtml5.)
 */

/** Email clients render 600 px wide; the picture goes in at 2× for retina. */
const EMAIL_WIDTH = 600;

/** The words on a design, top to bottom: its alt text and preview line. */
export const wordsOf = (layers: BoardItem[]): string[] =>
  layers
    .filter((l) => (l.kind === "text" || l.kind === "note") && l.body?.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((l) => (l.body ?? "").replace(/\s+/g, " ").trim());

/**
 * A table-built email around the design as one linked picture.
 *
 * Tables and inline styles because Outlook still renders mail with Word.
 * The words go in as the picture's alt text and the hidden preview line, so
 * an inbox that blocks images still shows what the email says.
 */
export const emailHtml = ({
  height,
  link,
  title,
  words,
}: {
  height: number;
  link: string;
  title: string;
  words: string[];
}): string => {
  const alt = escapeHtml(words.join(" — "));
  const preview = escapeHtml(words.slice(1).join(" ") || words[0] || "");
  const image = `<img src="images/email.png" width="${EMAIL_WIDTH}" height="${height}" alt="${alt}" style="display:block;width:100%;max-width:${EMAIL_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none">`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EMAIL_WIDTH}px;background:#ffffff">
<tr><td>${link ? `<a href="${escapeHtml(link)}" target="_blank">${image}</a>` : image}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
};

export const exportEmail = async (
  frame: BoardItem,
  layers: BoardItem[],
  textElementFor: (id: string) => HTMLElement | null,
  link: string
): Promise<Blob> => {
  const png = await renderCreative(
    frame,
    layers,
    EMAIL_WIDTH * 2,
    textElementFor,
    "#ffffff"
  );
  const html = emailHtml({
    height: Math.round((frame.height / frame.width) * EMAIL_WIDTH),
    link,
    title: frame.body?.trim() || "Email",
    words: wordsOf(layers),
  });
  return zip([
    { bytes: new TextEncoder().encode(html), name: "index.html" },
    {
      bytes: new Uint8Array(await png.arrayBuffer()),
      name: "images/email.png",
    },
  ]);
};

/** Rows within this share of a slide's height read as one row. */
const ROW = 0.5;

/** The deck's slides in reading order: rows top to bottom, then left to right. */
export const deckSlides = (items: BoardItem[]): BoardItem[] => {
  const slides = items.filter(
    (i) => i.kind === "frame" && groupFromTitle(i.body) === "Deck"
  );
  return slides.sort((a, b) => {
    const sameRow = Math.abs(a.y - b.y) < Math.min(a.height, b.height) * ROW;
    return sameRow ? a.x - b.x : a.y - b.y;
  });
};

export const exportDeckPdf = async (items: BoardItem[]): Promise<Blob> => {
  const slides = deckSlides(items);
  const pages: PdfPage[] = [];
  // One at a time: each slide is a full-size canvas, and a deck of twenty at
  // once is more memory than a phone will give a tab.
  for (const slide of slides) {
    const layers = layersOf(slide, items);
    // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose, for memory (above)
    const png = await withTextGhosts(layers, (textElementFor) =>
      renderCreative(
        slide,
        layers,
        exportWidthFor(slide),
        textElementFor,
        "#ffffff"
      )
    );
    pages.push(await jpegPage(png));
  }
  return slidesPdf(pages);
};
