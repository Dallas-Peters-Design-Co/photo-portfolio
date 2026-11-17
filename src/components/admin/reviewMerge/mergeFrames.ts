import type { MergeImage } from "../../../../config/brandMerge.js";
import { renderFrameBlob } from "../../../boards/io/frameRender";
import { currentFrameRender } from "../../../boards/io/frameRenderKey";
import { portfolioService } from "../../../services/portfolioService";
import type { BoardItem } from "../../../types";

/**
 * A frame from the review's board as a picture for the merge page: its
 * stored render while that's current, else drawn now and uploaded. Kept as
 * a plain address with its size, so the page needs no board to show it.
 */

const sizeOf = (url: string): Promise<{ height: number; width: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ height: img.naturalHeight, width: img.naturalWidth });
    img.onerror = () =>
      reject(new Error("Couldn't read that frame's picture."));
    img.src = url;
  });

export const frameImage = async (
  frame: BoardItem,
  items: BoardItem[]
): Promise<MergeImage> => {
  let url = currentFrameRender(frame, items);
  if (!url) {
    const blob = await renderFrameBlob(frame, items);
    const name = `${(frame.body ?? "frame").trim() || "frame"}.png`;
    ({ url } = await portfolioService.uploadImageFile(
      new File([blob], name, { type: "image/png" }),
      undefined,
      "boards/frames"
    ));
  }
  return { ...(await sizeOf(url)), url };
};

/** The board's frames, in reading order, for the pickers. */
export const framesOf = (items: BoardItem[]): BoardItem[] =>
  items
    .filter((item) => item.kind === "frame")
    .sort((a, b) => a.y - b.y || a.x - b.x);
