import type { MergeImage } from "../../../../config/brandMerge.js";
import { renderFrameAt } from "../../../boards/io/frameRender";
import { portfolioService } from "../../../services/portfolioService";
import type { BoardItem } from "../../../types";

/**
 * A frame from the review's board as a picture for the merge page: drawn at
 * twice its size (as a frame download is) and uploaded. Kept as a plain
 * address with its size, so the page needs no board to show it.
 *
 * Not the frame's stored render: that is drawn at 1x, capped at 2048 px, for
 * the nodes a frame feeds, and full width on the page it came out soft.
 */

/** Twice the frame's size: sharp full width on a high-density screen. */
const MERGE_DENSITY = 2;

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
  const blob = await renderFrameAt(frame, items, MERGE_DENSITY);
  const name = `${(frame.body ?? "frame").trim() || "frame"}@2x.png`;
  const { url } = await portfolioService.uploadImageFile(
    new File([blob], name, { type: "image/png" }),
    undefined,
    "boards/frames"
  );
  return { ...(await sizeOf(url)), url };
};

/** The board's frames, in reading order, for the pickers. */
export const framesOf = (items: BoardItem[]): BoardItem[] =>
  items
    .filter((item) => item.kind === "frame")
    .sort((a, b) => a.y - b.y || a.x - b.x);
