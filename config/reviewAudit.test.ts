import { describe, expect, it } from "vitest";
import { isRichTextEmpty } from "./proposal.js";
import { DEFAULT_REVIEW_DOC, type ReviewDoc } from "./review.js";
import { appendRich, mergeAudit, sanitizeUxAudit } from "./reviewAudit.js";

const review = (): ReviewDoc => ({
  ...DEFAULT_REVIEW_DOC,
  screens: [
    {
      id: "home",
      image: { height: 900, url: "https://x.test/a.png", width: 1440 },
      marks: [],
      note: "",
      pins: [
        { body: "", id: "old", kind: "praise", title: "Mine", x: 0.1, y: 0.1 },
      ],
      sourceUrl: "https://x.test",
      title: "Home",
      viewport: "desktop",
    },
  ],
  summary: "What I wrote first.",
});

const raw = {
  execSummary: "Clear offer, weak path to contact.",
  findings: [
    {
      area: "Navigation",
      detail: "The contact link is in the footer only.",
      headline: "Contact is hard to find",
      kind: "issue",
      screenId: "home",
      x: 0.8,
      y: 1.7,
    },
    {
      area: "Performance",
      detail: "Fonts block the first paint.",
      headline: "Slow first paint",
      kind: "made-up",
      screenId: "not-a-screen",
    },
  ],
  nowFraming: "Most issues are about what comes next.",
  principles: [
    { detail: "Good.", name: "Familiar layout", status: "pass" },
    { detail: "Fix.", name: "Visible focus", status: "attention" },
  ],
  recommendations: [{ detail: "Put it in the header.", title: "Add contact" }],
  strengths: [{ detail: "Big type.", title: "Readable" }],
};

describe("sanitizeUxAudit", () => {
  it("bounds coordinates, defaults bad kinds, and unplaces unknown screens", () => {
    const audit = sanitizeUxAudit(raw, ["home"]);
    expect(audit.findings[0]).toMatchObject({ screenId: "home", x: 0.8, y: 1 });
    expect(audit.findings[1]).toMatchObject({ kind: "issue", screenId: null });
  });

  it("survives a reply that is not an object at all", () => {
    expect(sanitizeUxAudit("nope", []).findings).toEqual([]);
  });
});

describe("mergeAudit", () => {
  const merged = mergeAudit(review(), sanitizeUxAudit(raw, ["home"]));

  it("adds placed findings as pins after the ones already there", () => {
    const pins = merged.screens[0]?.pins ?? [];
    expect(pins.map((p) => p.title)).toEqual([
      "Mine",
      "Contact is hard to find",
    ]);
  });

  it("keeps the summary that was written and adds the audit's after it", () => {
    const text = JSON.stringify(merged.summary);
    expect(text).toContain("What I wrote first.");
    expect(text).toContain("Clear offer, weak path to contact.");
  });

  it("writes one editable section per list, plus the unplaced findings", () => {
    expect(merged.sections.map((s) => s.title)).toEqual([
      "Strengths",
      "Principles",
      "Recommendations",
      "Further findings",
    ]);
    expect(JSON.stringify(merged.sections[3]?.body)).toContain(
      "Slow first paint"
    );
  });

  it("lists principles that need attention before the ones that pass", () => {
    const body = JSON.stringify(merged.sections[1]?.body);
    expect(body.indexOf("Visible focus")).toBeLessThan(
      body.indexOf("Familiar layout")
    );
  });
});

describe("appendRich", () => {
  it("returns the addition alone when there was nothing before", () => {
    const addition = { content: [{ type: "paragraph" }], type: "doc" };
    expect(appendRich("", addition)).toBe(addition);
    expect(isRichTextEmpty(appendRich("  ", addition))).toBe(true);
  });
});
