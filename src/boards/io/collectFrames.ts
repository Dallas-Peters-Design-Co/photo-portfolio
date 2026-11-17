import { containedBy } from "../../../config/graph.js";
import { portfolioService } from "../../services/portfolioService";
import type { BoardItem, BoardWire } from "../../types";
import { isDesignFrame } from "../geometry/frameLock";
import { outputImagesOf } from "../itemOutput";
import { renderFrameAt } from "./frameRender";
import { currentFrameRender } from "./frameRenderKey";

/**
 * What "Save to a collection" keeps from a selection.
 *
 * A designed frame is one picture: the design, drawn. Its parts (the photo,
 * the type, the logo) are not what was made, so they are left out, along with
 * anything selected that sits inside it. Everything else hands over its
 * pictures the way a wire would.
 */
export type Collectable = { frame: BoardItem } | { url: string };

export const collectablesOf = (
  selection: BoardItem[],
  graph: { items: BoardItem[]; wires: BoardWire[] }
): Collectable[] => {
  const designed = selection.filter((item) => isDesignFrame(item, graph.items));
  const inside = new Set(
    designed.flatMap((frame) =>
      containedBy(frame, graph.items).map((i) => i.id)
    )
  );
  return selection.flatMap((item): Collectable[] => {
    if (designed.includes(item)) {
      return [{ frame: item }];
    }
    if (inside.has(item.id)) {
      return [];
    }
    return outputImagesOf(item, graph).map((url) => ({ url }));
  });
};

/** With nothing selected, a designed frame under the pointer is what's saved. */
export const collectablesFor = (
  selection: BoardItem[],
  frame: BoardItem | null | undefined,
  graph: { items: BoardItem[]; wires: BoardWire[] }
): Collectable[] =>
  collectablesOf(
    selection.length === 0 && frame && isDesignFrame(frame, graph.items)
      ? [frame]
      : selection,
    graph
  );

const upload = async (png: Blob): Promise<string> =>
  (
    await portfolioService.uploadImageFile(
      new File([png], "frame.png", { type: "image/png" }),
      undefined,
      "boards/frames"
    )
  ).url;

/**
 * Each collectable as a link: a designed frame drawn at 2× and uploaded,
 * unless its current render is already stored (frameRenderKey.ts).
 */
export const collectableUrls = async (
  list: Collectable[],
  items: BoardItem[]
): Promise<string[]> => {
  const urls: string[] = [];
  // One at a time: each frame is a full canvas.
  for (const entry of list) {
    if ("url" in entry) {
      urls.push(entry.url);
      continue;
    }
    const stored = currentFrameRender(entry.frame, items);
    if (stored) {
      urls.push(stored);
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: sequential for memory (above)
    urls.push(await renderFrameAt(entry.frame, items).then(upload));
  }
  return urls;
};
