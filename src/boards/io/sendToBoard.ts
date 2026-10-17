import type { BoardItem } from "../../types";
import { newItemId } from "./newItemId";

/**
 * Pictures, sent from one board onto another.
 *
 * Sent as plain `reference` items — the picture, not the node that made it.
 * A node's results are written only by its own runs and never travel in a
 * save, so copying the node would arrive empty; the picture is what was chosen.
 *
 * Placed to the right of whatever the target already holds, in a short grid,
 * so nothing lands on top of somebody's arrangement and the new arrivals read
 * as one group.
 */

export interface SentPicture {
  height?: number | null;
  url: string;
  width?: number | null;
}

/** How wide each arrival is, before its own proportions set the height. */
export const SENT_WIDTH = 480;
const GAP = 48;
const COLUMNS = 4;
/** Where the first picture lands on an empty board. */
const ORIGIN = { x: 200, y: 200 };

const heightFor = (picture: SentPicture): number => {
  const { height, width } = picture;
  return width && height && width > 0 && height > 0
    ? Math.round((SENT_WIDTH * height) / width)
    : SENT_WIDTH;
};

export const sentItems = (
  pictures: SentPicture[],
  existing: readonly BoardItem[]
): BoardItem[] => {
  const right = existing.length
    ? Math.max(...existing.map((item) => item.x + item.width))
    : null;
  const top = existing.length
    ? Math.min(...existing.map((item) => item.y))
    : ORIGIN.y;
  const left = right === null ? ORIGIN.x : right + GAP * 3;
  const firstZ = existing.length
    ? Math.max(...existing.map((item) => item.z)) + 1
    : 1;

  // Each row is as tall as its tallest picture, so mixed shapes never overlap.
  const rows: number[] = [];
  pictures.forEach((picture, index) => {
    const row = Math.floor(index / COLUMNS);
    rows[row] = Math.max(rows[row] ?? 0, heightFor(picture));
  });
  const rowTop = (row: number) =>
    top + rows.slice(0, row).reduce((sum, h) => sum + h + GAP, 0);

  return pictures.map((picture, index) => ({
    body: null,
    config: null,
    creditName: null,
    creditUrl: null,
    fontSize: null,
    height: heightFor(picture),
    id: newItemId(),
    imageUrl: picture.url,
    kind: "reference",
    nodeType: null,
    photoId: null,
    result: null,
    runError: null,
    runState: null,
    thumbUrl: picture.url,
    width: SENT_WIDTH,
    x: left + (index % COLUMNS) * (SENT_WIDTH + GAP),
    y: rowTop(Math.floor(index / COLUMNS)),
    z: firstZ + index,
  }));
};
