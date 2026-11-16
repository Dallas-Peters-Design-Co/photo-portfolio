import { describe, expect, it } from "vitest";
import { cleanPin } from "./review.js";
import { criteriaOfAxeTags, wcagCriterion, wcagUrl } from "./wcag.js";

describe("wcag", () => {
  it("reads WCAG criteria from axe-core's tags", () => {
    expect(
      criteriaOfAxeTags(["cat.color", "wcag2aa", "wcag143", "wcag1410", "ACT"])
    ).toEqual(["1.4.3", "1.4.10"]);
  });

  it("links a criterion to the W3C page on meeting it", () => {
    const contrast = wcagCriterion("1.4.3");
    expect(contrast?.name).toBe("Contrast (Minimum)");
    expect(contrast && wcagUrl(contrast)).toBe(
      "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    );
  });

  it("keeps an accessibility note's known criteria and safe links only", () => {
    const pin = cleanPin({
      kind: "accessibility",
      wcag: {
        criteria: ["1.4.3", "9.9.9", "1.4.3"],
        rule: "color-contrast",
        ruleUrl: "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
      },
    });
    expect(pin.wcag).toEqual({
      criteria: ["1.4.3"],
      rule: "color-contrast",
      ruleUrl: "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
    });
    expect(
      cleanPin({
        kind: "accessibility",
        wcag: { criteria: ["1.1.1"], ruleUrl: "javascript:alert(1)" },
      }).wcag
    ).toEqual({ criteria: ["1.1.1"] });
    // Other kinds carry no WCAG details.
    expect(
      cleanPin({ kind: "issue", wcag: { criteria: ["1.1.1"] } }).wcag
    ).toBeUndefined();
  });
});
