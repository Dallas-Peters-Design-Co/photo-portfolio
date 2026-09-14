import { containedBy } from "../../../config/graph";
import type { Board, BoardItem } from "../../types";
import { isVideoUrl } from "../io/isVideo";
import { currentImageUrl } from "../itemOutput";

/**
 * A published board as a run of slides.
 *
 * A board is one wide canvas; a presentation is a sequence. The frames are
 * the sequence: each frame is a section, in reading order across the board
 * — rows top to bottom, left to right within a row — and each picture in a
 * frame is a slide, in the same order within the frame. A frame's name
 * becomes a section card before its pictures, and the board's title opens
 * the deck. Pictures outside any frame are not shown: the board is where you
 * work, and framing something is how you say it is finished.
 *
 * Pure, so the order a deck plays in can be pinned by a test rather than
 * found out on a client call.
 */

export type Slide =
  | { kind: "title"; title: string; subtitle: string | null }
  | { kind: "section"; title: string; count: number }
  | {
      kind: "picture";
      url: string;
      video: boolean;
      /** The frame this picture belongs to. */
      section: string;
      /** The picture's own caption, when it has one. */
      caption: string | null;
      /** Its place among the section's pictures, from 1. */
      index: number;
      count: number;
    };

/**
 * Frames in reading order.
 *
 * Two frames are on the same row when the top of the lower one is above the
 * vertical middle of the upper one — a row of frames drawn by hand is never
 * aligned to the pixel, and a strict sort on y would read a row as a column.
 */
export const framesInReadingOrder = <T extends BoardItem>(frames: T[]): T[] => {
  const byTop = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: T[][] = [];
  for (const frame of byTop) {
    const row = rows.at(-1);
    const lead = row?.[0];
    if (lead && frame.y < lead.y + lead.height / 2) {
      row.push(frame);
    } else {
      rows.push([frame]);
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
};

/** The frame's name as typed, or nothing. */
const nameOf = (frame: BoardItem): string | null => frame.body?.trim() || null;

/** A picture's own caption: a note typed on a photo, never a node's settings. */
const captionOf = (item: BoardItem): string | null =>
  item.kind === "op" ? null : item.body?.trim() || null;

export const slidesOf = (
  board: Pick<Board, "title" | "items">,
  subtitle: string | null = null
): Slide[] => {
  const items = board.items ?? [];
  const frames = framesInReadingOrder(
    items.filter((item) => item.kind === "frame")
  );
  const slides: Slide[] = [{ kind: "title", subtitle, title: board.title }];
  for (const frame of frames) {
    const pictures = framesInReadingOrder(
      containedBy(frame, items).filter((item) => Boolean(currentImageUrl(item)))
    );
    if (pictures.length === 0) {
      continue;
    }
    const section = nameOf(frame) ?? "";
    if (section) {
      slides.push({ count: pictures.length, kind: "section", title: section });
    }
    pictures.forEach((item, at) => {
      const url = currentImageUrl(item) as string;
      slides.push({
        caption: captionOf(item),
        count: pictures.length,
        index: at + 1,
        kind: "picture",
        section,
        url,
        video: isVideoUrl(url),
      });
    });
  }
  return slides;
};
