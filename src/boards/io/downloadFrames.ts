import type { ZipFile } from "../../lib/zip";
import type { BoardItem } from "../../types";
import { exportWidthFor } from "../creative/exportPng";
import { isDesignFrame } from "../geometry/frameLock";
import { renderFrameAt } from "./frameRender";

/**
 * Every designed frame on a board, for a visitor to download: each as a PNG
 * and as an SVG, in one zip. Only designed frames: a workflow group, a
 * Social Preview and any other node is left out.
 *
 * Each PNG is drawn fresh at twice the frame's size (renderFrameAt), so its
 * type and shapes stay sharp on a high-density screen or zoomed in. The SVG
 * holds that same picture at the frame's own size, so it opens and scales
 * in any design tool; its parts are not separate, editable shapes.
 */

const SLUG_RUN = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;

/** Designed frames in reading order: top to bottom, then left to right. */
export const downloadableFrames = (items: BoardItem[]): BoardItem[] =>
  items
    .filter((item) => isDesignFrame(item, items))
    .sort((a, b) => a.y - b.y || a.x - b.x);

const slugOf = (text: string): string =>
  text
    .toLowerCase()
    .replace(SLUG_RUN, "-")
    .replace(EDGE_HYPHENS, "")
    .slice(0, 60);

/** A file name per frame, unique within the zip: "hero", "hero-2". */
export const frameFileNames = (frames: BoardItem[]): string[] => {
  const used = new Map<string, number>();
  return frames.map((frame, i) => {
    const base = slugOf(frame.body?.trim() ?? "") || `frame-${i + 1}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
};

const bytesOf = async (blob: Blob): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await blob.arrayBuffer());

const base64Of = (bytes: Uint8Array): string => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x80_00) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x80_00));
  }
  return btoa(text);
};

/** The picture as an SVG at the frame's real size (its export width). */
export const svgOfPng = (
  png: Uint8Array,
  width: number,
  height: number
): string => {
  const w = Math.round(width);
  const h = Math.round(height);
  const data = `data:image/png;base64,${base64Of(png)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" preserveAspectRatio="none" href="${data}" xlink:href="${data}"/></svg>`;
};

/**
 * The zip's files: png/<name>.png and svg/<name>.svg per frame. One frame
 * at a time, for memory; a frame that fails is named in `failed`.
 */
export const frameFiles = async (
  items: BoardItem[],
  onProgress: (done: number, total: number) => void,
  frames: BoardItem[] = downloadableFrames(items)
): Promise<{ failed: string[]; files: ZipFile[] }> => {
  const names = frameFileNames(frames);
  const encoder = new TextEncoder();
  const files: ZipFile[] = [];
  const failed: string[] = [];
  for (const [i, frame] of frames.entries()) {
    const name = names[i] ?? `frame-${i + 1}`;
    onProgress(i, frames.length);
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one full canvas at a time
      const png = await bytesOf(await renderFrameAt(frame, items));
      files.push(
        { bytes: png, name: `png/${name}.png` },
        {
          bytes: encoder.encode(
            svgOfPng(
              png,
              exportWidthFor(frame),
              (exportWidthFor(frame) * frame.height) / frame.width
            )
          ),
          name: `svg/${name}.svg`,
        }
      );
    } catch {
      failed.push(frame.body?.trim() || name);
    }
  }
  onProgress(frames.length, frames.length);
  return { failed, files };
};
