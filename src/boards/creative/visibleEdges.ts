import { type RefObject, useEffect, useRef } from "react";
import type { BoardItem } from "../../types";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import { anchorFractions, anchorOf, fitOf } from "./imageAnchor";
import { rotationOf } from "./rotate";

/**
 * Where a layer's drawing actually starts and stops inside its box, so smart
 * guides line up what you see rather than the boxes: a picture's see-through
 * margins and a text box's spare room round its letters are left out.
 * Insets are in canvas units, from each side of the box inward.
 */
export interface Insets {
  b: number;
  l: number;
  r: number;
  t: number;
}

/** What's opaque in a picture, as fractions of it, and its own size. */
interface Opaque {
  b: number;
  h: number;
  l: number;
  r: number;
  t: number;
  w: number;
}

const opaque = new Map<string, Opaque | "loading">();
const SAMPLE = 384;

const scan = (img: HTMLImageElement): Opaque => {
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const whole = { b: 1, h, l: 0, r: 1, t: 0, w };
  const k = Math.min(1, SAMPLE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) {
    return whole;
  }
  try {
    g.drawImage(img, 0, 0, cw, ch);
    const { data } = g.getImageData(0, 0, cw, ch);
    let x0 = cw;
    let y0 = ch;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < ch; y += 1) {
      for (let x = 0; x < cw; x += 1) {
        if ((data[(y * cw + x) * 4 + 3] ?? 0) > 24) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    return x1 < 0
      ? whole
      : { b: (y1 + 1) / ch, h, l: x0 / cw, r: (x1 + 1) / cw, t: y0 / ch, w };
  } catch {
    // A picture from somewhere that won't share its pixels: its whole box.
    return whole;
  }
};

/** Starts reading a picture's opaque area, once; ready on a later call. */
export const warmPicture = (url: string) => {
  if (opaque.has(url)) {
    return;
  }
  opaque.set(url, "loading");
  const load = (cors: boolean) => {
    const img = new Image();
    if (cors) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => opaque.set(url, scan(img));
    img.onerror = () => (cors ? load(false) : opaque.delete(url));
    img.src = url;
  };
  load(true);
};

/** Insets for a picture of known opaque area, fitted and anchored in `box`. */
export const pictureInsets = (
  box: { height: number; width: number },
  pic: Opaque,
  fit: "contain" | "cover",
  anchor: { x: number; y: number }
): Insets => {
  const s =
    fit === "cover"
      ? Math.max(box.width / pic.w, box.height / pic.h)
      : Math.min(box.width / pic.w, box.height / pic.h);
  const dw = pic.w * s;
  const dh = pic.h * s;
  const ox = (box.width - dw) * anchor.x;
  const oy = (box.height - dh) * anchor.y;
  const x0 = Math.max(0, ox + pic.l * dw);
  const y0 = Math.max(0, oy + pic.t * dh);
  const x1 = Math.min(box.width, ox + pic.r * dw);
  const y1 = Math.min(box.height, oy + pic.b * dh);
  return {
    b: Math.max(0, box.height - y1),
    l: x0,
    r: Math.max(0, box.width - x1),
    t: y0,
  };
};

const metrics = new Map<string, { asc: number; cap: number; desc: number }>();
/** The font's ascent, cap height and descent, as shares of its content box. */
const fontShape = (font: string) => {
  const had = metrics.get(font);
  if (had) {
    return had;
  }
  const g = document.createElement("canvas").getContext("2d");
  if (!g) {
    return null;
  }
  g.font = font;
  const m = g.measureText("H");
  const asc = m.fontBoundingBoxAscent || 0;
  const desc = m.fontBoundingBoxDescent || 0;
  const cap = m.actualBoundingBoxAscent || 0;
  if (!(asc + desc > 0 && cap > 0)) {
    return null;
  }
  const shape = { asc, cap, desc };
  metrics.set(font, shape);
  return shape;
};

/**
 * Text: from the left of its first letters to the right of its last, and
 * from the cap height of the top line to the baseline of the bottom one.
 */
interface Runs {
  bottom: { font: string; rect: DOMRect } | null;
  left: number;
  right: number;
  spacing: number;
  top: { font: string; rect: DOMRect } | null;
}

/** The text's line pieces on screen: their outer edges and fonts. */
const runsOf = (el: HTMLElement): Runs => {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const runs: Runs = {
    bottom: null,
    left: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    spacing: 0,
    top: null,
  };
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.textContent?.trim()) {
      const style = getComputedStyle(n.parentElement ?? el);
      range.selectNodeContents(n);
      addRects(runs, [...range.getClientRects()], style);
    }
  }
  return runs;
};

const addRects = (runs: Runs, rects: DOMRect[], style: CSSStyleDeclaration) => {
  for (const rect of rects.filter((r) => r.width > 0)) {
    runs.left = Math.min(runs.left, rect.left);
    runs.right = Math.max(runs.right, rect.right);
    if (!runs.top || rect.top < runs.top.rect.top) {
      runs.top = { font: style.font, rect };
    }
    if (!runs.bottom || rect.bottom > runs.bottom.rect.bottom) {
      runs.bottom = { font: style.font, rect };
    }
    runs.spacing = Math.max(0, Number.parseFloat(style.letterSpacing) || 0);
  }
};

const textInsets = (el: HTMLElement, scale: number): Insets | null => {
  const { bottom, left, right, spacing, top } = runsOf(el);
  if (!(top && bottom)) {
    return null;
  }
  const box = el.getBoundingClientRect();
  const topShape = fontShape(top.font);
  const bottomShape = fontShape(bottom.font);
  // The text's content box runs ascent + descent; cap height and baseline
  // sit inside it.
  const capTop = topShape
    ? top.rect.top +
      (top.rect.height * (topShape.asc - topShape.cap)) /
        (topShape.asc + topShape.desc)
    : top.rect.top;
  const baseline = bottomShape
    ? bottom.rect.bottom -
      (bottom.rect.height * bottomShape.desc) /
        (bottomShape.asc + bottomShape.desc)
    : bottom.rect.bottom;
  return {
    b: Math.max(0, (box.bottom - baseline) / scale),
    l: Math.max(0, (left - box.left) / scale),
    // Letter spacing is also added after the last letter.
    r: Math.max(0, (box.right - right + spacing) / scale),
    t: Math.max(0, (capTop - box.top) / scale),
  };
};

/** A layer's insets, or null where its box is what's drawn. */
export const insetsOf = (
  item: BoardItem,
  el: HTMLElement | null,
  scale: number
): Insets | null => {
  if (rotationOf(item) !== 0) {
    return null;
  }
  if ((item.kind === "text" || item.kind === "note") && el) {
    return textInsets(el, scale);
  }
  const url =
    item.kind === "reference" || item.kind === "photo"
      ? currentImageUrl(item)
      : null;
  const pic = url ? opaque.get(url) : undefined;
  if (url && !pic) {
    warmPicture(url);
  }
  return pic && pic !== "loading"
    ? pictureInsets(item, pic, fitOf(item), anchorFractions(anchorOf(item)))
    : null;
};

/** The box drawn inside `box`. */
export const shrink = (box: Box, ins: Insets | null): Box =>
  ins
    ? {
        height: Math.max(1, box.height - ins.t - ins.b),
        width: Math.max(1, box.width - ins.l - ins.r),
        x: box.x + ins.l,
        y: box.y + ins.t,
      }
    : box;

/**
 * The artboard's measuring of visible edges: each layer measured once per
 * drag (reset when it ends), pictures read ahead as they arrive.
 */
export const useVisibleEdges = (
  boardRef: RefObject<HTMLElement | null>,
  layers: BoardItem[],
  scale: number
) => {
  const cache = useRef(new Map<string, Insets | null>());
  const urls = layers
    .filter((l) => l.kind === "reference" || l.kind === "photo")
    .map(currentImageUrl)
    .filter((u): u is string => Boolean(u))
    .join("\n");
  useEffect(() => {
    for (const url of urls.split("\n").filter(Boolean)) {
      warmPicture(url);
    }
  }, [urls]);
  const of = (item: BoardItem): Insets | null => {
    if (cache.current.has(item.id)) {
      return cache.current.get(item.id) ?? null;
    }
    const el = boardRef.current?.querySelector<HTMLElement>(
      `[data-layer-id="${CSS.escape(item.id)}"]`
    );
    const ins = insetsOf(item, el ?? null, scale);
    cache.current.set(item.id, ins);
    return ins;
  };
  return {
    boxOf: (item: BoardItem): Box =>
      shrink(
        { height: item.height, width: item.width, x: item.x, y: item.y },
        of(item)
      ),
    insetsOf: of,
    reset: () => cache.current.clear(),
  };
};
