import { describe, expect, it } from "vitest";
import {
  cleanMark,
  PIN_KINDS,
  PIN_LABELS,
  sanitizeReviewDoc,
} from "./review.js";

const screen = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  image: { height: 900, url: "https://x.test/shot.png", width: 1440 },
  note: "",
  pins: [],
  sourceUrl: "",
  title: "Home",
  viewport: "desktop",
  ...over,
});

describe("review markup", () => {
  it("keeps boxes, highlights and arrows as two points, clamped to the image", () => {
    const box = cleanMark({
      id: "m1",
      kind: "box",
      points: [
        [0.1, 0.2],
        [1.4, -0.3],
        [0.5, 0.5],
      ],
    });
    expect(box).toEqual({
      id: "m1",
      kind: "box",
      points: [
        [0.1, 0.2],
        [1, 0],
      ],
    });
  });

  it("thins a very long pen stroke rather than cutting it off", () => {
    const points = Array.from({ length: 1200 }, (_, i) => [i / 1200, 0.5]);
    const pen = cleanMark({ id: "p", kind: "pen", points });
    expect(pen?.points.length).toBeLessThanOrEqual(400);
    expect(pen?.points.at(-1)?.[0]).toBeGreaterThan(0.9);
  });

  it("drops unknown kinds and marks with fewer than two points", () => {
    expect(
      cleanMark({
        kind: "circle",
        points: [
          [0, 0],
          [1, 1],
        ],
      })
    ).toBeNull();
    expect(cleanMark({ kind: "arrow", points: [[0, 0]] })).toBeNull();
  });

  it("gives older screens with no markup an empty list", () => {
    const doc = sanitizeReviewDoc({ screens: [screen()] });
    expect(doc.screens[0]?.marks).toEqual([]);
  });

  it("round-trips markup through the sanitizer", () => {
    const marks = [
      {
        id: "a",
        kind: "arrow",
        points: [
          [0.1, 0.1],
          [0.4, 0.3],
        ],
      },
      {
        id: "h",
        kind: "highlight",
        points: [
          [0.2, 0.2],
          [0.6, 0.4],
        ],
      },
    ];
    const doc = sanitizeReviewDoc({ screens: [screen({ marks })] });
    expect(doc.screens[0]?.marks.map((m) => m.kind)).toEqual([
      "arrow",
      "highlight",
    ]);
  });
});

describe("recommendation notes", () => {
  it("is a pin kind with its own label, and survives sanitizing", () => {
    expect(PIN_KINDS).toContain("recommendation");
    expect(PIN_LABELS.recommendation).toBe("Recommendation");
    const doc = sanitizeReviewDoc({
      screens: [
        screen({
          pins: [
            {
              id: "p",
              kind: "recommendation",
              title: "Add a CTA",
              x: 0.5,
              y: 0.5,
            },
          ],
        }),
      ],
    });
    expect(doc.screens[0]?.pins[0]?.kind).toBe("recommendation");
  });
});

describe("review sections", () => {
  it("defaults to none, so reviews from before sections still load", () => {
    expect(sanitizeReviewDoc({}).sections).toEqual([]);
  });

  it("keeps each section's title and body, and fills a missing id", () => {
    const doc = sanitizeReviewDoc({
      sections: [{ body: "Clear pricing.", title: "Strengths" }, "junk"],
    });
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0]).toMatchObject({
      body: "Clear pricing.",
      title: "Strengths",
    });
    expect(doc.sections[0]?.id).toBeTruthy();
    expect(doc.sections[1]).toMatchObject({ body: "", title: "" });
  });
});
