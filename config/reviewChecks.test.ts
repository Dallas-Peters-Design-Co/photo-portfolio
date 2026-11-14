import { describe, expect, it } from "vitest";
import { DEFAULT_REVIEW_DOC } from "./review.js";
import {
  checkSections,
  mergeChecks,
  REFERENCE_NAMES,
  sanitizeChecks,
} from "./reviewChecks.js";

const raw = [
  {
    observations: [
      {
        detail: "Six top-level menu items.",
        screen: "Home — desktop",
        severity: "Pass",
      },
      { detail: "", screen: "Home", severity: "High" },
      { detail: "Odd level.", screen: "Home", severity: "Severe" },
    ],
    reference: "Hick's Law",
    status: "pass",
    summary: "Choices are few.",
  },
  {
    observations: [],
    reference: "Hick's Law",
    status: "attention",
    summary: "Duplicate",
  },
  { observations: [], reference: "Made-up Law", status: "pass", summary: "x" },
  {
    observations: [],
    reference: "Typography",
    status: "weird",
    summary: "Sizes vary.",
  },
];

describe("sanitizeChecks", () => {
  it("keeps known references once, drops empty observations, bounds values", () => {
    const checks = sanitizeChecks(raw);
    expect(checks.map((c) => c.reference)).toEqual([
      "Hick's Law",
      "Typography",
    ]);
    expect(checks[0]?.observations).toHaveLength(2);
    expect(checks[0]?.observations[1]?.severity).toBe("Medium");
    expect(checks[1]?.status).toBe("opportunity");
    expect(sanitizeChecks("nonsense")).toEqual([]);
  });

  it("asks for all 43 references", () => {
    expect(REFERENCE_NAMES).toHaveLength(43);
    expect(new Set(REFERENCE_NAMES).size).toBe(43);
  });
});

describe("checkSections", () => {
  it("writes one section per group and names what was not checked", () => {
    const sections = checkSections(sanitizeChecks(raw));
    expect(sections.map((s) => s.title)).toEqual([
      "Validation: Heuristic audit",
      "Validation: Laws of UX",
      "Validation: Design references",
    ]);
    const laws = JSON.stringify(sections[1]?.body);
    expect(laws).toContain("Hick's Law — Working");
    expect(laws).toContain("Home — desktop · Pass");
    expect(laws).toContain("Not checked: Miller's Law");
    expect(laws).not.toContain("Not checked: Miller's Law, Hick's Law");
  });

  it("adds nothing when the agent returned no checks", () => {
    expect(mergeChecks(DEFAULT_REVIEW_DOC, [])).toEqual(DEFAULT_REVIEW_DOC);
  });
});
