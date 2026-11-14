import { containedBy } from "../../../config/graph.js";
import type { BoardItem } from "../../types";

/**
 * A designed frame as one picture, for the nodes it's wired into.
 *
 * A frame normally hands down a wire every picture sitting on it. A designed
 * one is a single composition, so what it should hand over is that, flattened:
 * rendered in the browser before a run (frameRender.ts), uploaded, and kept on
 * the frame as `renderUrl` with `renderKey`, a fingerprint of the frame and
 * its layers when it was drawn. The render counts only while the fingerprint
 * still matches, so editing the design makes the next run draw it again.
 */

/** A short, steady hash of a string, enough to tell versions apart. */
const hash = (text: string): string => {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 33 + text.charCodeAt(i)) % 2_147_483_647;
  }
  return `${h.toString(36)}.${text.length.toString(36)}`;
};

/** What the frame looks like now: its box and every layer on it. */
export const frameKeyOf = (frame: BoardItem, items: BoardItem[]): string =>
  hash(
    JSON.stringify([
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      frame.body,
      ...containedBy(frame, items).map((i) => [
        i.id,
        i.kind,
        i.x,
        i.y,
        i.width,
        i.height,
        i.z,
        i.rotation ?? 0,
        i.body,
        i.fontSize,
        i.textStyle ?? null,
        i.imageUrl,
        i.result?.url ?? null,
        i.config ?? null,
      ]),
    ])
  );

/** The frame's flattened render, if it still matches the frame as it is. */
export const currentFrameRender = (
  frame: BoardItem,
  items: BoardItem[]
): string | null => {
  const url = frame.config?.renderUrl;
  return frame.kind === "frame" &&
    typeof url === "string" &&
    url &&
    frame.config?.renderKey === frameKeyOf(frame, items)
    ? url
    : null;
};
