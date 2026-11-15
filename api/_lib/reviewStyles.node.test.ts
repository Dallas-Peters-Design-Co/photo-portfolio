import { describe, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../config/brandKit.js";
import { DEFAULT_REVIEW_DOC } from "../../config/review.js";
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
