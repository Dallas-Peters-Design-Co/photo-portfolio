import { expect, it, vi } from "vitest";
import { createConcept } from "../../../config/conceptDefaults.js";
import type { PageDesign } from "../../../config/pageDesign.js";
import {
  DEFAULT_REVIEW_DOC,
  sanitizeReviewDoc,
} from "../../../config/review.js";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";

const update = vi.fn(async (_slug: string, input: unknown) => input);
const get = vi.fn();
vi.mock("../../services/reviewService", () => ({
  reviewsApi: { get, list: async () => [], update },
}));
const { publishBoardReview, countCaptured, reviewScreens } = await import(
  "./publishReview"
);

it("publishes live frames and republishes their layout without replacing review notes or feedback", async () => {
  const pageDesign: PageDesign = {
    boxes: {},
    concept: createConcept(),
    height: 900,
    kitId: null,
    version: 1,
    width: 1440,
  };
  const item: BoardItem = {
    ...BLANK_ITEM,
    body: "Results",
    config: { pageDesign },
    height: 450,
    id: "page",
    kind: "frame",
    width: 720,
    x: 0,
    y: 0,
    z: 0,
  };
  const previous = {
    ...reviewScreens([item])[0],
    note: "Keep this explanation",
  };
  get.mockResolvedValue({
    brandKitId: null,
    clientName: "Client",
    doc: { ...DEFAULT_REVIEW_DOC, intro: "Opening", screens: [previous] },
    feedback: [{ body: "Client comment" }],
    title: "Review",
  });
  const changed = {
    ...item,
    config: { pageDesign: { ...pageDesign, width: 1200 } },
  };
  expect(countCaptured([changed])).toBe(1);
  await publishBoardReview({
    board: { id: "board", slug: "board", title: "Board" },
    clientName: "",
    items: [changed],
    title: "",
  });
  const input = update.mock.calls[0]?.[1] as { doc: unknown };
  const stored = sanitizeReviewDoc(input.doc);
  expect(stored.screens).toHaveLength(1);
  expect(stored.screens[0]).toMatchObject({
    id: "page",
    image: null,
    note: "Keep this explanation",
    pageDesign: { width: 1200 },
  });
  expect(stored.intro).toBe("Opening");
  expect(input).not.toHaveProperty("feedback");
  expect(input).not.toHaveProperty("password");
});

it("orders a page and a linked browser screen by their positions on the board", () => {
  const page: BoardItem = {
    ...BLANK_ITEM,
    config: {
      pageDesign: {
        boxes: {},
        concept: createConcept(),
        height: 900,
        kitId: null,
        version: 1,
        width: 1440,
      },
    },
    height: 450,
    id: "page",
    kind: "frame",
    width: 720,
    x: 0,
    y: 0,
    z: 0,
  };
  const browser: BoardItem = {
    ...BLANK_ITEM,
    config: {
      captureHeight: 900,
      captureUrl: "https://example.com/page.png",
      captureWidth: 1440,
      reviewScreenId: "existing-screen",
    },
    height: 450,
    id: "browser-node",
    kind: "op",
    nodeType: "browser",
    width: 720,
    x: 0,
    y: 500,
    z: 0,
  };
  expect(reviewScreens([browser, page]).map((screen) => screen.id)).toEqual([
    "page",
    "existing-screen",
  ]);
});
