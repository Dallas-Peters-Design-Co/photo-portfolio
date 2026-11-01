import { describe, expect, it } from "vitest";
import { parseVariants, readCopyRequest } from "../_lib/creativeCopy.js";

describe("creative copy", () => {
  it("reads variants out of a reply, fences and all", () => {
    const reply =
      'Here you go:\n```json\n{"variants":[{"angle":"Longevity","headline":"A laptop that lasts a workday.","body":"All-day battery.","cta":"See Lumen One"},{"angle":"x","headline":"","body":"","cta":""}]}\n```';
    expect(parseVariants(reply)).toEqual([
      {
        angle: "Longevity",
        body: "All-day battery.",
        cta: "See Lumen One",
        headline: "A laptop that lasts a workday.",
      },
    ]);
    expect(parseVariants("no json here")).toEqual([]);
  });

  it("clamps what the editor sends", () => {
    const req = readCopyRequest({
      brief: "x".repeat(5000),
      current: { headline: 12 },
      language: "Deutsch",
    });
    expect(req.brief).toHaveLength(1200);
    expect(req.current.headline).toBe("");
    expect(req.language).toBe("Deutsch");
  });
});
