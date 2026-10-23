import { DEFAULT_IMAGE_WIDTH } from "../../../../config/canvas.js";
import { newItemId } from "../../../boards/io/newItemId";
import type { BoardItem } from "../../../types";
import { BLANK_ITEM } from "./placement";

/**
 * A Clip node, built the one way every path that makes one needs.
 *
 * Three paths make them — a file dropped on the board, one chosen from the
 * tool rail, and a clip pulled off a Video node's results — and a clip that
 * landed a different shape depending on how it arrived would be the sort of
 * disagreement this board keeps having.
 */

/** Room under the picture for the name; see ClipNode. */
const CAPTION_HEIGHT = 44;

/** What a clip is assumed to be until it says otherwise. */
const WIDESCREEN = 9 / 16;

export const clipItem = ({
  name,
  point,
  size,
  url,
  z,
}: {
  name: string | null;
  /** Where the clip's centre lands. */
  point: { x: number; y: number };
  /** The clip's own dimensions, when they could be read. */
  size: { height: number; width: number } | null;
  url: string;
  z: number;
}): BoardItem => {
  const width = DEFAULT_IMAGE_WIDTH;
  const ratio = size ? size.height / size.width : WIDESCREEN;
  const height = Math.round(width * ratio) + CAPTION_HEIGHT;
  return {
    ...BLANK_ITEM,
    config: name ? { clipUrl: url, name } : { clipUrl: url },
    height,
    id: newItemId(),
    kind: "op",
    nodeType: "clip",
    runState: "idle",
    width,
    x: Math.round(point.x - width / 2),
    y: Math.round(point.y - height / 2),
    z,
  };
};
