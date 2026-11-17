import { describe, expect, it } from "vitest";
import { DEFAULT_REVIEW_DOC, sanitizeReviewDoc } from "./review.js";
import { mergeAudit, sanitizeUxAudit } from "./reviewAudit.js";
import { cleanCoverage, MAX_BRIEF } from "./reviewBrief.js";

describe("cleanCoverage", () => {
  it("keeps named items and reads an unknown status as missing", () => {
    expect(
      cleanCoverage([
        { item: " Export ", status: "covered", where: "Export screen" },
        { item: "Colour blindness", status: "maybe" },
        { item: "", status: "covered" },
        "nonsense",
      ])
    ).toEqual([
      { item: "Export", status: "covered", where: "Export screen" },
      { item: "Colour blindness", status: "missing", where: "" },
    ]);
  });
});

describe("the review's brief", () => {
  it("is kept on the document, bounded", () => {
    const doc = sanitizeReviewDoc({ brief: "x".repeat(MAX_BRIEF + 10) });
    expect(doc.brief).toHaveLength(MAX_BRIEF);
    expect(doc.briefCoverage).toEqual([]);
  });

  it("takes the audit's coverage, and keeps the last when an audit has none", () => {
    const covered = [{ item: "Search", status: "partial" as const, where: "" }];
    const once = mergeAudit(
      DEFAULT_REVIEW_DOC,
      sanitizeUxAudit({ coverage: covered }, [])
    );
    expect(once.briefCoverage).toEqual(covered);
    const again = mergeAudit(once, sanitizeUxAudit({}, []));
    expect(again.briefCoverage).toEqual(covered);
  });
});
