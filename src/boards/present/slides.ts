import { clipUrlOf } from "../../../config/nodes/clip.js";
import type { Board, BoardItem } from "../../types";
import { layersOf } from "../creative/creativeModel";
import { isVideoUrl } from "../io/isVideo";
import { currentImageUrl } from "../itemOutput";

/**
 * A published board as a run of slides.
 *
 * A board is one wide canvas; a presentation is a sequence. The frames are
 * the sequence, in reading order across the board (rows top to bottom, left
 * to right within a row), and each frame is one slide, shown whole as it was
 * designed: a poster, a cover, a page of studies. The board's title opens the
 * deck. Things outside any frame are not shown: the board is where you work,
 * and framing something is how you say it is finished. A board with nothing
 * framed at all plays every picture on it instead, rather than a title card
 * and nothing else.
 *
 * Pure, so the order a deck plays in can be pinned by a test rather than
 * found out on a client call.
 */

export type Slide =
  | { kind: "title"; title: string; subtitle: string | null }
  | {
      kind: "frame";
      frame: BoardItem;
      /** What the frame holds, back to front. */
      layers: BoardItem[];
      title: string;
      /** Its place in the deck's frames, from 1. */
      index: number;
      count: number;
    }
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

/** What a slide shows for an item: its picture, or a Clip node's video. */
const mediaOf = (item: BoardItem): string | null =>
  currentImageUrl(item) ??
  (item.nodeType === "clip" ? clipUrlOf(item.config) : null);

/** Items in reading order, each picture once (copies pinned twice play once). */
const picturesIn = (items: BoardItem[]): BoardItem[] => {
  const seen = new Set<string>();
  return framesInReadingOrder(items.filter((item) => mediaOf(item))).filter(
    (item) => {
      const url = mediaOf(item) as string;
      if (seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    }
  );
};

const pictureSlides = (pictures: BoardItem[], section: string): Slide[] =>
  pictures.map((item, at) => {
    const url = mediaOf(item) as string;
    return {
      caption: captionOf(item),
      count: pictures.length,
      index: at + 1,
      kind: "picture",
      section,
      url,
      video: isVideoUrl(url),
    };
  });

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
  const filled = frames
    .map((frame) => ({ frame, layers: layersOf(frame, items) }))
    .filter(({ layers }) => layers.length > 0);
  filled.forEach(({ frame, layers }, at) => {
    slides.push({
      count: filled.length,
      frame,
      index: at + 1,
      kind: "frame",
      layers,
      title: nameOf(frame) ?? "",
    });
  });
  if (slides.length === 1) {
    slides.push(
      ...pictureSlides(
        picturesIn(items.filter((item) => item.kind !== "frame")),
        ""
      )
    );
  }
  return slides;
};
