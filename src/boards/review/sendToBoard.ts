import {
  BROWSER_NODE_SIZE,
  browserConfigOf,
} from "../../../config/nodes/browser.js";
import type { ReviewScreen } from "../../../config/review.js";
import { boardsApi } from "../../services/portfolioService";
import type { ReviewRecord } from "../../services/reviewService";
import type { Board, BoardItem } from "../../types";
import { newItemId } from "../io/newItemId";

/**
 * A review sent to a board, to be worked on there.
 *
 * Each screen with a picture becomes a Browser node: its picture, markup and
 * numbered notes, the page it came from. The review holds the board's id
 * (doc.boardId), so sending again updates the same board, and the board's
 * "Publish a review" updates this review (publishReview.ts).
 *
 * Pictures: a review's are private, read through links that expire, but a
 * board's canvas and its nodes need lasting addresses. So each picture is
 * copied into the board's own image store, as every board picture is, and
 * only again when the review's picture changes. Publishing back copies the
 * board's pictures into the private review store (api/_lib/reviewImages.ts),
 * so the review stays private.
 *
 * Sending updates what the review owns on each node (picture, markup, notes,
 * title, page) and keeps where the node sits and anything else on the board.
 * A node whose screen was removed from the review stays on the board.
 */

const GAP = 80;
const PER_ROW = 3;

/** A private picture's address without its expiring signature. */
const plainUrl = (url: string): string => url.split("?")[0] ?? url;

const loadBoard = async (id: string | null): Promise<Board | null> => {
  if (!id) {
    return null;
  }
  try {
    return await boardsApi.get(id);
  } catch {
    // Deleted, or unreachable: a new board is made instead.
    return null;
  }
};

/** Where the next new node goes: rows of three, right of what is there. */
const placer = (items: readonly BoardItem[]) => {
  const right = items.reduce((max, i) => Math.max(max, i.x + i.width), 0);
  const top = items.length > 0 ? Math.min(...items.map((i) => i.y)) : 0;
  const left = items.length > 0 ? right + GAP * 2 : 0;
  let n = 0;
  return () => {
    const col = n % PER_ROW;
    const row = Math.floor(n / PER_ROW);
    n += 1;
    return {
      x: left + col * (BROWSER_NODE_SIZE.width + GAP),
      y: top + row * (BROWSER_NODE_SIZE.height + GAP),
    };
  };
};

const nodeConfig = (
  screen: ReviewScreen,
  captureUrl: string,
  before: Record<string, unknown> | null
): Record<string, unknown> => {
  const image = screen.image as NonNullable<ReviewScreen["image"]>;
  return {
    ...before,
    captureHeight: image.height,
    captureUrl,
    captureWidth: image.width,
    marks: screen.marks,
    notes: screen.pins,
    pageUrl: screen.sourceUrl,
    reviewImage: plainUrl(image.url),
    reviewScreenId: screen.id,
    title: screen.title,
    // A node made here starts on the page the screen shows.
    url: (before?.url as string | undefined) || screen.sourceUrl,
    viewport: screen.viewport,
  };
};

/**
 * Sends the review to its board, making the board on the first send.
 * Resolves with the board; the caller saves its id on the review.
 */
export const sendReviewToBoard = async (
  review: Pick<ReviewRecord, "doc" | "title">
): Promise<Board> => {
  const board =
    (await loadBoard(review.doc.boardId)) ??
    (await boardsApi.create(review.title || "Review"));
  const items = [...(board.items ?? [])];
  const place = placer(items);
  let z = items.reduce((max, i) => Math.max(max, i.z), 0);
  const indexOf = (screen: ReviewScreen) =>
    items.findIndex(
      (i) =>
        i.nodeType === "browser" &&
        browserConfigOf(i.config).reviewScreenId === screen.id
    );

  // Copied again only when the review's picture is not the one sent last.
  const captureUrls = await Promise.all(
    review.doc.screens.map((screen) => {
      if (!screen.image) {
        return null;
      }
      const at = indexOf(screen);
      const cfg = at >= 0 ? browserConfigOf(items[at]?.config) : null;
      const unchanged =
        cfg?.capture && cfg.reviewImage === plainUrl(screen.image.url);
      return unchanged
        ? (cfg.capture?.url as string)
        : boardsApi.adopt(screen.image.url);
    })
  );

  for (const [n, screen] of review.doc.screens.entries()) {
    const captureUrl = captureUrls[n];
    if (!(screen.image && captureUrl)) {
      continue;
    }
    const at = indexOf(screen);
    const before = at >= 0 ? items[at] : undefined;
    const config = nodeConfig(screen, captureUrl, before?.config ?? null);

    if (before) {
      items[at] = { ...before, config };
      continue;
    }
    z += 1;
    items.push({
      body: null,
      config,
      creditName: null,
      creditUrl: null,
      fontSize: null,
      height: BROWSER_NODE_SIZE.height,
      id: newItemId(),
      imageUrl: null,
      kind: "op",
      nodeType: "browser",
      photoId: null,
      result: null,
      runError: null,
      runState: "idle",
      thumbUrl: null,
      width: BROWSER_NODE_SIZE.width,
      ...place(),
      z,
    });
  }

  return boardsApi.update(board.id, {
    baseUpdatedAt: board.updatedAt,
    items,
    wires: board.wires ?? [],
  });
};
