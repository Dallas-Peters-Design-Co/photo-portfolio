import { describe, expect, it } from "vitest";
import { DEFAULT_REVIEW_DOC, sanitizeReviewDoc } from "./review.js";
import { mergeAudit, sanitizeUxAudit } from "./reviewAudit.js";
import { cleanCoverage, gapBrief, MAX_BRIEF } from "./reviewBrief.js";

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

describe("gapBrief", () => {
  it("puts the open items first and stays inside the brief's limit", () => {
    const text = gapBrief(
      "x".repeat(MAX_BRIEF),
      [
        {
          item: "Export",
          status: "missing",
          where: "Capture the export dialog",
        },
      ],
      ["Dashboard — desktop"]
    );
    expect(text).toContain("- Export: Capture the export dialog");
    expect(text).toContain("- Dashboard — desktop");
    expect(text.length).toBe(MAX_BRIEF);
    expect(text.indexOf("Export")).toBeLessThan(text.indexOf("xxxx"));
  });
});
