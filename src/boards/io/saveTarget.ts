import { clipLabelOf, clipUrlOf } from "../../../config/nodes/clip.js";
import type { BoardItem } from "../../types";
import { isVideoUrl } from "./isVideo";

/**
 * What "Save" hands over for one item: the file, its name, and what it is.
 *
 * A picture is asked of the caller, because the toolbar and the canvas menu
 * resolve it differently. A Clip node is answered here: it keeps its file in
 * config rather than as a picture, so neither resolver sees it, and a clip
 * placed on the board had no way back off it.
 */
export interface SaveTarget {
  label: string;
  /** What to call it on a button: "Save this clip". */
  noun: "clip" | "picture";
  url: string;
}

export const saveTargetOf = (
  item: BoardItem | null,
  picture: string | null
): SaveTarget | null => {
  if (!item) {
    return null;
  }
  const clipUrl = item.nodeType === "clip" ? clipUrlOf(item.config) : null;
  if (clipUrl) {
    return { label: clipLabelOf(item.config), noun: "clip", url: clipUrl };
  }
  if (!picture) {
    return null;
  }
  // A clip pinned as a reference arrives here as its "picture".
  return {
    label: item.body ?? "image",
    noun: isVideoUrl(picture) ? "clip" : "picture",
    url: picture,
  };
};
