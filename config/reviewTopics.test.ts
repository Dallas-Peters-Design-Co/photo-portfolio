import { describe, expect, it } from "vitest";
import { DEFAULT_REVIEW_DOC } from "./review.js";
import { mergeAudit, sanitizeUxAudit } from "./reviewAudit.js";
import { withoutAudit } from "./reviewRedo.js";
import { cleanAuditTopic } from "./reviewTopics.js";

describe("a deep audit's topic passes", () => {
  it("keep their points by priority and drop empty ones", () => {
    const topic = cleanAuditTopic(
      {
        points: [
          {
            detail: "Pills use colour alone",
            priority: "must-fix",
            screens: ["Shortlist"],
            title: "Status pills",
          },
          { detail: "", title: "" },
          { detail: "x", priority: "nonsense", title: "Odd" },
        ],
        summary: "Mostly fine.",
      },
      "Colour"
    );
    expect(topic?.points.map((p) => p.priority)).toEqual([
      "must-fix",
      "recommended",
    ]);
    expect(cleanAuditTopic({ points: [] }, "Colour")).toBeNull();
  });

  it("become sections of the review, marked so a redo replaces them", () => {
    const audit = {
      ...sanitizeUxAudit({}, []),
      topics: [
        {
          points: [
            {
              detail: "Use #0f766e for actions only.",
              priority: "rule" as const,
              screens: [],
              title: "Action colour",
            },
            {
              detail: "Add a label.",
              priority: "must-fix" as const,
              screens: ["Search"],
              title: "Colour-only status",
            },
          ],
          summary: "Two jobs share one teal.",
          title: "Colour",
        },
      ],
    };
    const merged = mergeAudit(DEFAULT_REVIEW_DOC, audit);
    const colour = merged.sections.find((s) => s.title === "Colour");
    expect(colour?.fromAudit).toBe(true);
    const body = JSON.stringify(colour?.body);
    expect(body).toContain("Must fix");
    expect(body).toContain("Seen on: Search.");
    expect(body.indexOf("Must fix")).toBeLessThan(body.indexOf("Rules"));
    expect(withoutAudit(merged).doc.sections).toHaveLength(0);
  });
});
