import { describe, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../config/brandKit.js";
import {
  createConcept,
  createConceptElement,
} from "../../config/conceptDefaults.js";
import type { PageDesign } from "../../config/pageDesign.js";
import { DEFAULT_REVIEW_DOC, type ReviewScreen } from "../../config/review.js";
import { cleanConcept } from "../../config/reviewConcept.js";
import type { ReviewDto } from "./reviews.js";

const loadKit = vi.fn();
vi.mock("./brandKitStore.js", () => ({ loadKit }));

const { withKitStyles } = await import("./reviewStyles.js");

const review = (brandKitId: string | null): ReviewDto =>
  ({
    brandKitId,
    doc: {
      ...DEFAULT_REVIEW_DOC,
      concepts: [
        cleanConcept({
          elements: [{ background: "#000000", kind: "badge", styleId: "pill" }],
        }),
      ],
    },
  }) as unknown as ReviewDto;

const styled = {
  resolvedDoc: {
    ...EMPTY_KIT,
    componentStyles: [
      {
        id: "pill",
        kind: "badge",
        look: { background: "#00ff00" },
        name: "Pill",
      },
    ],
  },
};

const sql = {} as never;

describe("withKitStyles", () => {
  it("draws linked concepts in the kit's current styles", async () => {
    loadKit.mockResolvedValueOnce(styled);
    const out = await withKitStyles(sql, review("kit-1"));
    expect(out.doc.concepts[0]?.elements[0]?.background).toBe("#00ff00");
  });

  it("leaves the review as saved without a kit, or when the kit fails", async () => {
    expect(
      (await withKitStyles(sql, review(null))).doc.concepts[0]?.elements[0]
        ?.background
    ).toBe("#000000");
    loadKit.mockRejectedValueOnce(new Error("down"));
    expect(
      (await withKitStyles(sql, review("kit-1"))).doc.concepts[0]?.elements[0]
        ?.background
    ).toBe("#000000");
  });
});

it("resolves each live page's brand without applying another page's kit", async () => {
  loadKit.mockReset();
  loadKit.mockImplementation(async (_sql: unknown, id: string) => ({
    resolvedDoc: {
      componentStyles: [
        {
          id: "shared",
          kind: "text",
          look: { color: id === "page-kit" ? "#ff0000" : "#0000ff" },
          name: "Heading",
        },
      ],
    },
  }));
  const heading = { ...createConceptElement("text"), styleId: "shared" };
  const concept = { ...createConcept(), elements: [heading] };
  const pageDesign: PageDesign = {
    boxes: {},
    concept,
    height: 900,
    kitId: "page-kit",
    version: 1,
    width: 1440,
  };
  const screen = (id: string, kitId: string | null): ReviewScreen => ({
    id,
    image: null,
    marks: [],
    note: "",
    pageDesign: { ...pageDesign, kitId },
    pins: [],
    sourceUrl: "",
    title: id,
    viewport: "desktop",
  });
  const multiKitReview = {
    ...review("review-kit"),
    doc: {
      ...DEFAULT_REVIEW_DOC,
      screens: [
        screen("a", "page-kit"),
        screen("b", "page-kit"),
        screen("c", "review-kit"),
        screen("d", null),
      ],
    },
  };
  const result = await withKitStyles(sql, multiKitReview);
  expect(
    result.doc.screens.map((s) => s.pageDesign?.concept.elements[0]?.color)
  ).toEqual(["#ff0000", "#ff0000", "#0000ff", heading.color]);
  expect(loadKit).toHaveBeenCalledTimes(2);
});

it("refreshes a published colour binding while preserving a literal of the same old colour", async () => {
  loadKit.mockResolvedValueOnce({
    resolvedDoc: {
      ...EMPTY_KIT,
      palette: [{ id: "info", name: "Info", role: "info", value: "#112233" }],
    },
  });
  const item = review("kit-1");
  item.doc.concepts = [
    cleanConcept({
      elements: [
        {
          background: "var(--kit-info, #eeeeee)",
          color: "#eeeeee",
          kind: "card",
        },
      ],
    }),
  ];
  const out = await withKitStyles(sql, item);
  expect(out.doc.concepts[0].elements[0]).toMatchObject({
    background: "var(--kit-info, #112233)",
    color: "#eeeeee",
  });
});
