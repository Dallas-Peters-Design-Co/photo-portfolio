import { describe, expect, it } from "vitest";
import { paletteComposition } from "./paletteComposition";

describe("paletteComposition", () => {
  it("places one vector swatch per colour, labelled, with no pictures", () => {
    const out = paletteComposition(["#0a1f44", "#f4c430"], ["Primary", ""]);
    const swatches = out.items.filter(
      (i) => i.kind === "drawing" && (i.config as { radius?: number }).radius
    );
    expect(swatches.map((s) => (s.config as { fill: string }).fill)).toEqual([
      "#0a1f44",
      "#f4c430",
    ]);
    expect(out.items.some((i) => i.kind === "reference" || i.imageUrl)).toBe(
      false
    );
    const words = out.items.filter((i) => i.kind === "text").map((i) => i.body);
    expect(words).toContain("Primary");
    expect(words).toContain("#0A1F44");
    expect(words).toContain("#F4C430");
  });
});
