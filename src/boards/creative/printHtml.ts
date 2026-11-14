import type { BoardItem } from "../../types";
import { expandAll } from "../components/model";
import { componentById } from "../components/store";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import {
  FONT_URL,
  fetchBytes,
  firstFamily,
  fontFaceRules,
  fontLinksFor,
  layerHtml,
  placeOf,
} from "./exportHtml5";
import { bleedBox, bleeds } from "./exportPng";
import { escapeHtml } from "./htmlBits";
import { rotationOf } from "./rotate";
import { lookOf, type TextLook } from "./textLook";

/**
 * A frame as one printable HTML sheet, for the server to print to a vector
 * PDF (api/_lib/printSheet.ts). Laid out in CSS pixels at their physical size
 * (96 to the inch), so the sheet is exactly the paper:
 *
 *   marks margin │ bleed │ trim (the design) │ bleed │ marks margin
 *
 * Layers that touch the frame's edge and can grow without changing shape
 * (pictures, box fills) run out into the bleed; the bleed's outer edge clips.
 * Crop marks are hairlines in the margin, lined up with the trim.
 *
 * Fonts the site hosts are copied in as data, since the server's browser
 * can't reach this one's local files; Google and Adobe go in as links.
 * Pictures held only in this browser (blob: addresses) are copied in too.
 */

export interface SheetLayout {
  bleedIn: number;
  heightIn: number;
  marksIn: number;
  widthIn: number;
}

const CSS_PX_PER_IN = 96;
/** A quarter point, the usual crop mark weight. */
const MARK_WEIGHT = (0.25 / 72) * CSS_PX_PER_IN;

const r2 = (n: number) => Math.round(n * 1000) / 1000;

const toDataUrl = (bytes: Uint8Array<ArrayBuffer>, type: string) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes], { type }));
  });

/** The site's own @font-face rules for these families, files inlined. */
const inlineFonts = async (families: Set<string>): Promise<string> => {
  const rules = fontFaceRules(families);
  const urls = [
    ...new Set(
      rules.flatMap((css) =>
        [...css.matchAll(FONT_URL)]
          .map(([, , url]) => url ?? "")
          .filter((url) => url && !url.startsWith("data:"))
      )
    ),
  ];
  const inlined = new Map<string, string>();
  await Promise.all(
    urls.map(async (url) => {
      const got = await fetchBytes(new URL(url, location.href).href);
      if (got) {
        inlined.set(url, await toDataUrl(got.bytes, got.type || "font/woff2"));
      }
    })
  );
  return rules
    .map((css) =>
      css.replaceAll(FONT_URL, (whole, _q, url: string) => {
        const data = inlined.get(url);
        if (data) {
          return `url("${data}")`;
        }
        return url.startsWith("data:")
          ? whole
          : `url("${new URL(url, location.href).href}")`;
      })
    )
    .join("\n");
};

/**
 * Where each picture loads from on the server: its own address, or the
 * picture itself when only this browser can reach it.
 */
const imageSources = async (
  layers: BoardItem[]
): Promise<Map<string, string>> => {
  const urls = [
    ...new Set(
      layers
        .filter(
          (l) => l.kind !== "drawing" && l.kind !== "text" && l.kind !== "note"
        )
        .map((l) => currentImageUrl(l))
        .filter((url): url is string => Boolean(url))
    ),
  ];
  const pairs = await Promise.all(
    urls.map(async (url) => {
      if (!url.startsWith("blob:")) {
        return [url, new URL(url, location.href).href] as const;
      }
      const got = await fetchBytes(url);
      return [
        url,
        got ? await toDataUrl(got.bytes, got.type || "image/png") : url,
      ] as const;
    })
  );
  return new Map(pairs);
};

/** Crop marks: two hairlines at each trim corner, out to the sheet's edge. */
export const cropMarksSvg = (layout: SheetLayout): string => {
  const m = layout.marksIn * CSS_PX_PER_IN;
  if (m <= 0) {
    return "";
  }
  const b = layout.bleedIn * CSS_PX_PER_IN;
  const w = layout.widthIn * CSS_PX_PER_IN;
  const h = layout.heightIn * CSS_PX_PER_IN;
  const sheetW = w + 2 * (b + m);
  const sheetH = h + 2 * (b + m);
  const xs = [m + b, m + b + w];
  const ys = [m + b, m + b + h];
  const lines: string[] = [];
  for (const x of xs) {
    // Vertical marks, above and below the bleed.
    lines.push(
      `M${r2(x)} 0V${r2(m)}`,
      `M${r2(x)} ${r2(sheetH - m)}V${r2(sheetH)}`
    );
  }
  for (const y of ys) {
    lines.push(
      `M0 ${r2(y)}H${r2(m)}`,
      `M${r2(sheetW - m)} ${r2(y)}H${r2(sheetW)}`
    );
  }
  return `<svg class="marks" width="${r2(sheetW)}" height="${r2(sheetH)}" viewBox="0 0 ${r2(sheetW)} ${r2(sheetH)}"><path d="${lines.join("")}" fill="none" stroke="#000" stroke-width="${r2(MARK_WEIGHT)}"/></svg>`;
};

const layerMarkup = (
  item: BoardItem,
  frame: Box,
  scale: number,
  bleed: number,
  images: Map<string, string>,
  looks: Map<string, TextLook>
): string | null => {
  const box = bleeds(item) ? bleedBox(item, frame, bleed) : item;
  const place = placeOf(box, frame, scale);
  const turn = rotationOf(item);
  return layerHtml(
    item,
    turn ? { ...place, transform: `rotate(${turn}deg)` } : place,
    scale,
    images,
    (id) => looks.get(id) ?? null
  );
};

export const printHtml = async (
  frame: BoardItem,
  given: BoardItem[],
  textElementFor: (id: string) => HTMLElement | null,
  layout: SheetLayout
): Promise<string> => {
  // A placed component is drawn as its layers.
  const layers = expandAll(given, componentById);
  const scale = (layout.widthIn * CSS_PX_PER_IN) / frame.width;
  // The bleed in frame units, for growing layers out to it.
  const bleed = (layout.bleedIn * CSS_PX_PER_IN) / scale;
  const looks = new Map<string, TextLook>();
  for (const item of layers) {
    const el = textElementFor(item.id);
    if (el && (item.kind === "text" || item.kind === "note")) {
      looks.set(item.id, lookOf(el));
    }
  }
  const families = new Set(
    [...looks.values()].map((look) => firstFamily(look.fontFamily))
  );
  const [images, fontCss] = await Promise.all([
    imageSources(layers),
    inlineFonts(families),
  ]);
  const body = layers
    .map((item) => layerMarkup(item, frame, scale, bleed, images, looks))
    .filter((markup): markup is string => markup !== null);

  const m = layout.marksIn;
  const b = layout.bleedIn;
  const sheetW = layout.widthIn + 2 * (b + m);
  const sheetH = layout.heightIn + 2 * (b + m);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(frame.body?.trim() || "Print")}</title>
${fontLinksFor(layers)
  .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
  .join("\n")}
<style>
${fontCss}
@page{size:${r2(sheetW)}in ${r2(sheetH)}in;margin:0}
html,body{margin:0;padding:0;background:#fff}
#sheet{position:relative;width:${r2(sheetW)}in;height:${r2(sheetH)}in;overflow:hidden}
#bleed{position:absolute;left:${r2(m)}in;top:${r2(m)}in;width:${r2(layout.widthIn + 2 * b)}in;height:${r2(layout.heightIn + 2 * b)}in;overflow:hidden;background:#fff}
#trim{position:absolute;left:${r2(b)}in;top:${r2(b)}in;width:${r2(layout.widthIn)}in;height:${r2(layout.heightIn)}in;-webkit-font-smoothing:antialiased}
#trim *{box-sizing:border-box;margin:0}
.marks{position:absolute;left:0;top:0}
</style>
</head>
<body>
<div id="sheet">
<div id="bleed"><div id="trim">
${body.join("\n")}
</div></div>
${cropMarksSvg(layout)}
</div>
</body>
</html>
`;
};
