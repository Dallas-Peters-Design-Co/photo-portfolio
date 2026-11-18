import { expect, it } from "vitest";
import { parseFrameConfig } from "../api/_lib/frameConfig.js";
import { createConcept } from "./conceptDefaults.js";
import { applyReviewStyles } from "./conceptStyle.js";
import { cleanPageDesign, type PageDesign } from "./pageDesign.js";
import { DEFAULT_REVIEW_DOC, sanitizeReviewDoc } from "./review.js";

const page = (): PageDesign => {
  const concept = createConcept();
  const id = concept.elements[0]?.id ?? "text";
  return {
    boxes: { [id]: { height: 120, width: 300, x: 40, y: 60 } },
    concept,
    height: 900,
    kitId: null,
    version: 1,
    width: 1440,
  };
};

it("keeps a live page through board and review validation", () => {
  const design = page();
  const kept = parseFrameConfig({ pageDesign: design });
  expect(kept?.designed).toBe(true);
  expect(kept?.pageDesign).toMatchObject({ boxes: design.boxes, width: 1440 });
  const review = sanitizeReviewDoc({
    ...DEFAULT_REVIEW_DOC,
    screens: [{ id: "page", pageDesign: kept?.pageDesign }],
  });
  expect(review.screens[0]?.pageDesign).toEqual(kept?.pageDesign);
  expect(review.screens[0]?.image).toBeNull();
});

it("bounds malformed positions and ignores boxes for nonexistent components", () => {
  const design = page();
  const id = design.concept.elements[0]?.id ?? "text";
  const clean = cleanPageDesign({
    ...design,
    boxes: {
      [id]: { height: Number.NaN, width: 9000, x: 490, y: -30 },
      missing: { height: 3, width: 3, x: 1, y: 1 },
    },
    width: 500,
  });
  expect(clean?.boxes[id]).toEqual({ height: 120, width: 10, x: 490, y: 0 });
  expect(clean?.boxes.missing).toBeUndefined();
  expect(cleanPageDesign({ version: 900 })).toBeNull();
});

it("applies current brand styles while retaining page layout and instance overrides", () => {
  const design = page();
  design.kitId = "kit";
  design.concept.elements = design.concept.elements.map((e) => ({
    ...e,
    fontSize: 32,
    overrides: ["fontSize"],
    styleId: "primary",
  }));
  const doc = {
    ...DEFAULT_REVIEW_DOC,
    screens: [
      {
        id: "page",
        image: null,
        marks: [],
        note: "",
        pageDesign: design,
        pins: [],
        sourceUrl: "",
        title: "",
        viewport: "desktop" as const,
      },
    ],
  };
  const styled = applyReviewStyles(
    doc,
    [
      {
        id: "primary",
        kind: "text",
        look: { color: "#ff0000", fontSize: 50 },
        name: "Primary",
      },
    ],
    "kit"
  );
  expect(styled.screens[0]?.pageDesign?.boxes).toEqual(design.boxes);
  expect(styled.screens[0]?.pageDesign?.concept.elements[0]).toMatchObject({
    color: "#ff0000",
    fontSize: 32,
    styleId: "primary",
  });
});
