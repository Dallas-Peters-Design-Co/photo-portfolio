import { pageDesignOf } from "../../../config/pageDesign.js";
import type { BoardItem, BoardWire } from "../../types";
import { layersOf } from "../creative/creativeModel";
import { exportWidthFor, renderCreative } from "../creative/exportPng";
import { withTextGhosts } from "../creative/textGhosts";
import { isDesignFrame } from "../geometry/frameLock";
import { currentFrameRender, frameKeyOf } from "./frameRenderKey";
import { withDpi } from "./pngDensity";

/**
 * Rendering designed frames for the nodes they feed (see frameRenderKey.ts).
 *
 * Only frames wired into something are drawn, and only when their render
 * is missing or out of date. Capped in width: models take a couple of
 * thousand pixels at most, and a 36-inch poster at print size would be a
 * slow upload for nothing.
 */
const MAX_WIDTH = 2048;

/** Designed frames wired out (into `target`, if given) needing a render. */
export const framesToRender = (
  items: BoardItem[],
  wires: BoardWire[],
  target?: string
): BoardItem[] =>
  items.filter(
    (frame) =>
      frame.kind === "frame" &&
      wires.some(
        (w) =>
          w.sourceItemId === frame.id && (!target || w.targetItemId === target)
      ) &&
      isDesignFrame(frame, items) &&
      !currentFrameRender(frame, items)
  );

/**
 * Frames wired into a shader that need a render, designed or not.
 *
 * A shader takes one picture, so a frame wired into it means the frame as
 * it looks. Without this only a frame marked designed was drawn, and any
 * other frame handed the shader its first picture, or nothing at all when
 * it held only type and shapes: the wire was there and the shader stayed
 * blank.
 */
export const framesIntoShaders = (
  items: BoardItem[],
  wires: BoardWire[]
): BoardItem[] =>
  items.filter(
    (frame) =>
      frame.kind === "frame" &&
      wires.some(
        (w) =>
          w.sourceItemId === frame.id &&
          items.some((i) => i.id === w.targetItemId && i.kind === "shader")
      ) &&
      !currentFrameRender(frame, items)
  );

/** Draws a frame exactly as it appears in the creative editor. */
export const renderFrameBlob = async (
  frame: BoardItem,
  items: BoardItem[]
): Promise<Blob> => {
  if (pageDesignOf(frame.config)) {
    throw new Error(
      "Publish this page to its review to share the live interface. Image export is not available for page designs yet."
    );
  }
  const layers = layersOf(frame, items);
  const width = Math.min(exportWidthFor(frame), MAX_WIDTH);
  return await withTextGhosts(layers, (textElementFor) =>
    renderCreative(frame, layers, width, textElementFor)
  );
};

/** Download density: twice the frame's size, sharp on any screen. */
export const DOWNLOAD_DENSITY = 2;
/** Longest side a download is drawn at; browsers refuse far larger canvases. */
const MAX_DOWNLOAD_SIDE = 8192;

/**
 * A frame drawn for someone to keep: `density` times its real size (its
 * export width), at most MAX_DOWNLOAD_SIDE on its longer side, and marked
 * as that many times 72 DPI, so it opens at the frame's size, sharp.
 */
export const renderFrameAt = async (
  frame: BoardItem,
  items: BoardItem[],
  density = DOWNLOAD_DENSITY
): Promise<Blob> => {
  if (pageDesignOf(frame.config)) {
    throw new Error(
      "Publish this page to its review to share the live interface. Image export is not available for page designs yet."
    );
  }
  const layers = layersOf(frame, items);
  const base = exportWidthFor(frame);
  const longest = base * Math.max(1, frame.height / frame.width);
  const k = Math.min(density, MAX_DOWNLOAD_SIDE / longest);
  const png = await withTextGhosts(layers, (textElementFor) =>
    renderCreative(frame, layers, Math.round(base * k), textElementFor)
  );
  return await withDpi(png, Math.round(72 * k));
};

/**
 * The board with each frame's render drawn, uploaded and stored on it.
 * A frame that fails keeps what it had; `onError` hears why.
 */
export const withFrameRenders = async (
  frames: BoardItem[],
  items: BoardItem[],
  upload: (png: Blob) => Promise<string>,
  onError: (message: string) => void
): Promise<BoardItem[]> => {
  const done = new Map<string, Record<string, unknown>>();
  // One at a time: each is a full canvas, and posters are big.
  for (const frame of frames) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential for memory (above)
      const png = await renderFrameBlob(frame, items);
      done.set(frame.id, {
        ...(frame.config ?? {}),
        renderKey: frameKeyOf(frame, items),
        renderUrl: await upload(png),
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't render the frame");
    }
  }
  return items.map((item) => {
    const config = done.get(item.id);
    return config ? { ...item, config } : item;
  });
};
