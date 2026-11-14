import type { BoardItem, BoardWire } from "../../types";
import { layersOf } from "../creative/creativeModel";
import { exportWidthFor, renderCreative } from "../creative/exportPng";
import { withTextGhosts } from "../creative/textGhosts";
import { isDesignFrame } from "../geometry/frameLock";
import { currentFrameRender, frameKeyOf } from "./frameRenderKey";

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
      const layers = layersOf(frame, items);
      const width = Math.min(exportWidthFor(frame), MAX_WIDTH);
      // biome-ignore lint/performance/noAwaitInLoops: sequential for memory (above)
      const png = await withTextGhosts(layers, (textElementFor) =>
        renderCreative(frame, layers, width, textElementFor)
      );
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
