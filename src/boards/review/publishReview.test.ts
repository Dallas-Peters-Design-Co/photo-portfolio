import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewScreen } from "../../../config/review.js";
import type { BoardItem } from "../../types";

const get = vi.fn();
const create = vi.fn(async (input: unknown) => input);
const update = vi.fn(async (_slug: string, input: unknown) => input);
vi.mock("../../services/reviewService", () => ({
  reviewsApi: { create, get, update },
}));

const { browserScreens, mergeScreens, publishBoardReview, reviewSlugFor } =
  await import("./publishReview");

const browser = (
  id: string,
  x: number,
  y: number,
  captured = true
): BoardItem =>
  ({
    config: {
      ...(captured
        ? {
            captureHeight: 900,
            captureUrl: `https://blob.example.com/${id}.png`,
            captureWidth: 1440,
          }
        : {}),
      marks: [
        {
          id: `${id}-m`,
          kind: "box",
          points: [
            [0, 0],
            [0.5, 0.5],
          ],
        },
      ],
      notes: [
        { body: "", id: `${id}-n`, kind: "issue", title: id, x: 0.2, y: 0.2 },
      ],
      pageUrl: `https://app.example.com/${id}`,
      title: `Page ${id}`,
    },
    id,
    kind: "op",
    nodeType: "browser",
    x,
    y,
  }) as unknown as BoardItem;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("browserScreens", () => {
  it("takes captured browser nodes only, in reading order, with their markup and notes", () => {
    const screens = browserScreens([
      browser("c", 0, 900),
      browser("b", 900, 20),
      browser("a", 0, 0),
      browser("empty", 400, 400, false),
      { id: "photo", kind: "photo", x: 0, y: 0 } as BoardItem,
    ]);
    expect(screens.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(screens[0]).toMatchObject({
      image: {
        height: 900,
        url: "https://blob.example.com/a.png",
        width: 1440,
      },
      sourceUrl: "https://app.example.com/a",
      title: "Page a",
    });
    expect(screens[0]?.pins[0]?.title).toBe("a");
    expect(screens[0]?.marks).toHaveLength(1);
  });

  it("keeps a paragraph written for the screen in the review editor", () => {
    const [screen] = browserScreens(
      [browser("a", 0, 0)],
      [{ id: "a", note: "Written in the editor" } as ReviewScreen]
    );
    expect(screen?.note).toBe("Written in the editor");
  });
});

describe("mergeScreens", () => {
  it("puts the board's screens first and keeps ones added in the editor", () => {
    const merged = mergeScreens(
      [
        { id: "manual" } as ReviewScreen,
        { id: "a", title: "old" } as ReviewScreen,
      ],
      [{ id: "a", title: "new" } as ReviewScreen]
    );
    expect(merged.map((s) => [s.id, s.title])).toEqual([
      ["a", "new"],
      ["manual", undefined],
    ]);
  });
});

describe("publishBoardReview", () => {
  const board = { id: "b1", slug: "Pretext Audit!", title: "Pretext" };

  it("names the review after the board", () => {
    expect(reviewSlugFor(board)).toBe("pretext-audit-review");
  });

  it("creates the review, published, with a password when one is given", async () => {
    get.mockRejectedValue(new Error("Review not found"));
    await publishBoardReview({
      board,
      clientName: "Vin",
      items: [browser("a", 0, 0)],
      password: "open sesame",
      title: "",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "Vin",
        password: "open sesame",
        slug: "pretext-audit-review",
        status: "published",
        title: "Pretext review",
      })
    );
  });

  it("updates the same review, keeping what was written there, and leaves the password alone", async () => {
    get.mockResolvedValue({
      clientName: "Vin",
      doc: {
        closing: "",
        intro: "Hello",
        screens: [{ id: "manual" }],
        sections: [],
        summary: "Findings",
      },
      title: "Pretext audit",
    });
    await publishBoardReview({
      board,
      clientName: "",
      items: [browser("a", 0, 0)],
      title: "",
    });
    const [slug, input] = update.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(slug).toBe("pretext-audit-review");
    expect(input).not.toHaveProperty("password");
    expect(input).toMatchObject({ clientName: "Vin", title: "Pretext audit" });
    const doc = input.doc as { intro: string; screens: { id: string }[] };
    expect(doc.intro).toBe("Hello");
    expect(doc.screens.map((s) => s.id)).toEqual(["a", "manual"]);
  });
});
