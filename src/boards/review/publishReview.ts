import { browserConfigOf } from "../../../config/nodes/browser.js";
import {
  DEFAULT_REVIEW_DOC,
  type ReviewScreen,
} from "../../../config/review.js";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import type { Board, BoardItem } from "../../types";

/**
 * A board's browser nodes, published as a review.
 *
 * Each screenshot taken in a Browser node becomes one screen of the review:
 * its picture, markup and numbered notes as drawn on the board, the page it
 * came from, in the order the nodes are read on the board (top to bottom,
 * then left to right). Publishing again updates the same review: screens
 * from the board are replaced, anything written in the review editor (the
 * opening, findings, a screen's paragraph, screens added there) is kept,
 * and so are the client's comments.
 */

/** Nodes this close in height are read as one row, left to right. */
const ROW_SLACK = 80;

const readingOrder = (a: BoardItem, b: BoardItem): number =>
  Math.abs(a.y - b.y) <= ROW_SLACK ? a.x - b.x : a.y - b.y;

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Every captured browser node, as review screens, in reading order. */
export const browserScreens = (
  items: readonly BoardItem[],
  existing: readonly ReviewScreen[] = []
): ReviewScreen[] =>
  items
    .filter((item) => item.nodeType === "browser")
    .filter((item) => browserConfigOf(item.config).capture !== null)
    .sort(readingOrder)
    .map((item) => {
      const cfg = browserConfigOf(item.config);
      const before = existing.find((s) => s.id === item.id);
      return {
        id: item.id,
        image: cfg.capture,
        marks: cfg.marks,
        // A paragraph written in the review editor stays.
        note: before?.note ?? "",
        pins: cfg.notes,
        sourceUrl: cfg.pageUrl,
        title: cfg.title || hostOf(cfg.pageUrl) || "Screen",
        viewport: cfg.viewport,
      };
    });

/** The board's screens first, then any the review editor added on its own. */
export const mergeScreens = (
  existing: readonly ReviewScreen[],
  fromBoard: readonly ReviewScreen[]
): ReviewScreen[] => {
  const ids = new Set(fromBoard.map((s) => s.id));
  return [...fromBoard, ...existing.filter((s) => !ids.has(s.id))];
};

const SLUG_JUNK = /[^a-z0-9]+/g;
const EDGES = /^-+|-+$/g;

/** The review a board publishes to: one per board, found again by address. */
export const reviewSlugFor = (board: Pick<Board, "id" | "slug" | "title">) => {
  const base = (board.slug || board.title || board.id.slice(0, 8))
    .toLowerCase()
    .replace(SLUG_JUNK, "-")
    .replace(EDGES, "")
    .slice(0, 60);
  return `${base || "board"}-review`;
};

export const countCaptured = (items: readonly BoardItem[]): number =>
  browserScreens(items).length;

export interface PublishInput {
  board: Pick<Board, "id" | "slug" | "title">;
  clientName: string;
  items: readonly BoardItem[];
  /** A new password; "" takes it off; undefined leaves it as it is. */
  password?: string;
  title: string;
}

const existingReview = async (slug: string): Promise<ReviewRecord | null> => {
  try {
    return await reviewsApi.get(slug);
  } catch {
    return null;
  }
};

/** Creates the board's review, or updates it, and publishes it. */
export const publishBoardReview = async ({
  board,
  clientName,
  items,
  password,
  title,
}: PublishInput): Promise<ReviewRecord> => {
  const slug = reviewSlugFor(board);
  const current = await existingReview(slug);
  if (current) {
    const screens = mergeScreens(
      current.doc.screens,
      browserScreens(items, current.doc.screens)
    );
    return reviewsApi.update(slug, {
      clientName: clientName || current.clientName,
      doc: { ...current.doc, screens },
      ...(password === undefined ? {} : { password }),
      status: "published",
      title: title || current.title,
    });
  }
  return reviewsApi.create({
    clientName,
    doc: { ...DEFAULT_REVIEW_DOC, screens: browserScreens(items) },
    ...(password ? { password } : {}),
    slug,
    status: "published",
    title: title || `${board.title} review`,
  });
};
