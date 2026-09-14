import { loadImage } from "./halftoneGl";
import {
  isMockupTemplateId,
  MOCKUP_TEMPLATES,
  renderTemplate,
  wrapBackWindow,
} from "./mockupTemplate";
import { readColor } from "./renderCoverNode";
import { isTrim, TRIMS } from "./wrapLayout";

/**
 * Rendering a Mockup node to a file.
 *
 * The work is mockupTemplate's; this reads the settings, loads the cover,
 * and turns the canvas into a PNG. Output size is the template's own window
 * — a few thousand pixels wide, never upscaled.
 */

export type MockupSettings = Record<string, unknown>;

export class MockupError extends Error {}

export interface MockupSources {
  cover: string | null;
  /** The print wrap, for a template that shows the back. */
  wrap: string | null;
}

/**
 * The colour along the cover's spine edge, as a hex string.
 *
 * The left three per cent of the cover, averaged. On a Poster that is the
 * band and the ground; on a Horizon the ground; on a finished cover from
 * anywhere else it is whatever runs to the spine, which is what a printed
 * back would be if nobody designed one. The commonest colour there, so a
 * spiral crossing the edge does not average to mud.
 */
/** A pixel's bin: 16 levels a channel, so near-identical pixels count together. */
const binOf = (r: number, g: number, b: number): number =>
  Math.floor(r / 16) * 256 + Math.floor(g / 16) * 16 + Math.floor(b / 16);

export const edgeColorOf = (cover: HTMLImageElement): string => {
  const w = Math.max(1, Math.round(cover.naturalWidth * 0.03));
  const h = Math.min(cover.naturalHeight, 512);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return "#293341";
  }
  ctx.drawImage(cover, 0, 0, w, cover.naturalHeight, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  // The commonest colour, not the mean: a spiral crossing the edge averages
  // to mud, while the ground it sits on is the colour that occurs most.
  const counts = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    const key = binOf(d[i], d[i + 1], d[i + 2]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  // The average of the pixels in the winning bin, so the result is a real
  // colour from the cover and not the bin's centre.
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const key = binOf(d[i], d[i + 1], d[i + 2]);
    if (key === best) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n += 1;
    }
  }
  const hex = (v: number) =>
    Math.round(v / Math.max(1, n))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
};

export const renderMockup = async (
  config: MockupSettings,
  sources: MockupSources
): Promise<Blob> => {
  if (!sources.cover) {
    throw new MockupError("Wire a cover into this node to make a mockup.");
  }
  const id = isMockupTemplateId(config.template)
    ? (config.template as string)
    : MOCKUP_TEMPLATES[0].id;
  const template = MOCKUP_TEMPLATES.find((t) => t.id === id);
  if (!template) {
    throw new MockupError("That mockup template is not available.");
  }

  const [cover, wrap] = await Promise.all([
    loadImage(sources.cover),
    sources.wrap ? loadImage(sources.wrap) : Promise.resolve(null),
  ]);
  const [trimW, trimH] = TRIMS[isTrim(config.trim) ? config.trim : "6x9"];
  const spine =
    config.back === "colour"
      ? readColor(config.spine, "#293341")
      : edgeColorOf(cover);
  const canvas = await renderTemplate(template.base, cover, {
    back: wrap
      ? {
          image: wrap,
          window: wrapBackWindow(
            wrap.naturalWidth / wrap.naturalHeight,
            trimW,
            trimH
          ),
        }
      : null,
    spine,
  });

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new MockupError("The mockup could not be saved as a picture.");
  }
  return blob;
};
