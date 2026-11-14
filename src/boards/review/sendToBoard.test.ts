import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REVIEW_DOC,
  type ReviewScreen,
} from "../../../config/review.js";
import type { Board, BoardItem } from "../../types";

const adopt = vi.fn(
  async (url: string) =>
    `https://board.example.com/${url.split("/").pop()?.split("?")[0]}`
);
const create = vi.fn(
  async (title: string): Promise<Board> => ({ ...BOARD, title })
);
const get = vi.fn(async (): Promise<Board> => BOARD);
const update = vi.fn(async (id: string, input: Partial<Board>) => ({
  ...BOARD,
  ...input,
  id,
}));
vi.mock("../../services/portfolioService", () => ({
  boardsApi: { adopt, create, get, update },
}));

const { sendReviewToBoard } = await import("./sendToBoard");

const BOARD: Board = {
  coverUrl: null,
  createdAt: "2026-11-14T00:00:00Z",
  id: "11111111-1111-4111-8111-111111111111",
  isPublic: false,
  items: [],
  slug: null,
  title: "Board",
  updatedAt: "2026-11-14T00:00:00Z",
  wires: [],
};

const PRIVATE = "https://store.private.blob.vercel-storage.com/screens";

const screen = (id: string, picture = true): ReviewScreen => ({
  id,
  image: picture
    ? {
        height: 900,
        url: `${PRIVATE}/${id}.png?vercel-blob-signature=x`,
        width: 1440,
      }
    : null,
  marks: [],
  note: "",
  pins: [
    {
      body: "Too small",
      id: `${id}-p`,
      kind: "issue",
      title: "Button",
      x: 0.5,
      y: 0.5,
    },
  ],
  sourceUrl: `https://client.example.com/${id}`,
  title: `Screen ${id}`,
  viewport: "desktop",
});

const review = (boardId: string | null, screens: ReviewScreen[]) => ({
  doc: { ...DEFAULT_REVIEW_DOC, boardId, screens },
  title: "Client site",
});

const sentItems = (): BoardItem[] =>
  (update.mock.calls.at(-1)?.[1] as { items?: BoardItem[] } | undefined)
    ?.items ?? [];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendReviewToBoard", () => {
  it("makes a board with a browser node per pictured screen, notes and all", async () => {
    await sendReviewToBoard(
      review(null, [screen("a"), screen("b", false), screen("c")])
    );
    expect(create).toHaveBeenCalledWith("Client site");
    const items = sentItems();
    expect(items).toHaveLength(2);
    const cfg = items[0]?.config as Record<string, unknown>;
    expect(items[0]?.nodeType).toBe("browser");
    expect(cfg).toMatchObject({
      captureUrl: "https://board.example.com/a.png",
      pageUrl: "https://client.example.com/a",
      reviewImage: `${PRIVATE}/a.png`,
      reviewScreenId: "a",
      title: "Screen a",
    });
    expect((cfg.notes as { title: string }[])[0]?.title).toBe("Button");
    // Side by side, not on top of each other.
    expect(items[1]?.x).toBeGreaterThan(items[0]?.x ?? 0);
  });

  it("updates the linked board in place and copies only changed pictures", async () => {
    const existing: BoardItem = {
      body: null,
      config: {
        captureHeight: 900,
        captureUrl: "https://board.example.com/a.png",
        captureWidth: 1440,
        reviewImage: `${PRIVATE}/a.png`,
        reviewScreenId: "a",
        session: "kept",
      },
      creditName: null,
      creditUrl: null,
      fontSize: null,
      height: 640,
      id: "22222222-2222-4222-8222-222222222222",
      imageUrl: null,
      kind: "op",
      nodeType: "browser",
      photoId: null,
      result: null,
      runError: null,
      runState: "idle",
      thumbUrl: null,
      width: 760,
      x: 500,
      y: 300,
      z: 1,
    };
    get.mockResolvedValueOnce({ ...BOARD, items: [existing] });
    const edited = { ...screen("a"), title: "Renamed" };
    await sendReviewToBoard(review(BOARD.id, [edited]));
    expect(create).not.toHaveBeenCalled();
    expect(adopt).not.toHaveBeenCalled();
    const [item] = sentItems();
    expect(item).toMatchObject({ id: existing.id, x: 500, y: 300 });
    expect(item?.config).toMatchObject({ session: "kept", title: "Renamed" });
  });

  it("makes a new board when the linked one is gone", async () => {
    get.mockRejectedValueOnce(new Error("Board not found"));
    await sendReviewToBoard(review(BOARD.id, [screen("a")]));
    expect(create).toHaveBeenCalled();
  });
});
