import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_DOC,
  type ReviewDoc,
  sanitizeReviewDoc,
} from "./review.js";
import { mergeAudit, sanitizeUxAudit } from "./reviewAudit.js";
import { hasAudit, withoutAudit } from "./reviewRedo.js";

const mine = {
  body: "",
  id: "mine",
  kind: "issue" as const,
  title: "Mine",
  x: 0.1,
  y: 0.1,
};

const review = (): ReviewDoc => ({
  ...DEFAULT_REVIEW_DOC,
  screens: [
    {
      id: "home",
      image: { height: 900, url: "https://x.test/a.png", width: 1440 },
      marks: [],
      note: "",
      pins: [mine],
      sourceUrl: null,
      title: "Home",
      viewport: "desktop",
    },
  ] as ReviewDoc["screens"],
  sections: [{ body: "My notes", id: "s-mine", title: "My notes" }],
  summary: {
    content: [
      { content: [{ text: "Mine.", type: "text" }], type: "paragraph" },
    ],
    type: "doc",
  },
});

const audit = (headline: string) =>
  sanitizeUxAudit(
    {
      execSummary: `Summary ${headline}`,
      findings: [{ headline, kind: "issue", screenId: "home", x: 0.5, y: 0.5 }],
      recommendations: [{ detail: "Do it", title: headline }],
    },
    ["home"]
  );

describe("redoing an audit", () => {
  it("takes out only what the audit wrote, through a save", () => {
    const audited = sanitizeReviewDoc(mergeAudit(review(), audit("First")));
    expect(hasAudit(audited)).toBe(true);
    const { doc, legacyPins } = withoutAudit(audited);
    expect(legacyPins).toBe(false);
    expect(doc.screens[0]?.pins.map((p) => p.id)).toEqual(["mine"]);
    expect(doc.sections.map((s) => s.title)).toEqual(["My notes"]);
    expect(JSON.stringify(doc.summary)).not.toContain("Summary First");
    expect(JSON.stringify(doc.summary)).toContain("Mine.");
  });

  it("replaces the last run instead of adding a second", () => {
    const once = mergeAudit(review(), audit("First"));
    const twice = mergeAudit(withoutAudit(once).doc, audit("Second"));
    const titles = twice.screens[0]?.pins.map((p) => p.title);
    expect(titles).toEqual(["Mine", "Second"]);
    expect(
      twice.sections.filter((s) => s.title === "Recommendations")
    ).toHaveLength(1);
  });

  it("keeps a summary that was edited after the audit", () => {
    const audited = mergeAudit(review(), audit("First"));
    const edited = {
      ...audited,
      summary: { content: [], type: "doc" as const },
    };
    expect(withoutAudit(edited).doc.summary).toEqual(edited.summary);
  });

  it("knows an older audit by its section titles, and keeps its pins", () => {
    const old: ReviewDoc = {
      ...review(),
      sections: [
        ...review().sections,
        { body: "x", id: "s1", title: "Recommendations" },
      ],
    };
    expect(hasAudit(old)).toBe(true);
    const { doc, legacyPins } = withoutAudit(old);
    expect(legacyPins).toBe(true);
    expect(doc.sections.map((s) => s.title)).toEqual(["My notes"]);
    expect(doc.screens[0]?.pins).toHaveLength(1);
  });
});
