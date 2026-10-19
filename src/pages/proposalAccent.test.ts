import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../config/theme.js";
import { accentInk, proposalAccentStyle } from "./proposalAccent";

/**
 * The accent is the site owner's choice and can be anything; the proposal
 * must stay readable whatever it is. These pin the readable variants.
 */

const PAPER = "#fbfaf7";

describe("proposal accent", () => {
  it.each(["#97990e", "#ffd400", "#7c7f01", "#1d4ed8", "#ffffff", "#000000"])(
    "darkens %s until it reads as text on the paper",
    (accent) => {
      expect(contrastRatio(accentInk(accent), PAPER)).toBeGreaterThanOrEqual(
        4.5
      );
    }
  );

  it("leaves an accent that already reads untouched", () => {
    expect(accentInk("#1d4ed8")).toBe("#1d4ed8");
  });

  it("puts dark ink on a bright accent and white on a dark one", () => {
    const bright = proposalAccentStyle("#97990e") as Record<string, string>;
    const dark = proposalAccentStyle("#1d4ed8") as Record<string, string>;
    expect(bright["--sheet-on-accent"]).toBe("#1b1a17");
    expect(dark["--sheet-on-accent"]).toBe("#ffffff");
    // The signature follows the ink: as drawn on a bright accent, white on a dark one.
    expect(bright["--sheet-signature-filter"]).toBe("none");
    expect(dark["--sheet-signature-filter"]).toBe("invert(1)");
  });

  it("falls back when the setting is not a colour", () => {
    const style = proposalAccentStyle("not-a-colour") as Record<string, string>;
    expect(style["--sheet-accent"]).toBe("#7c7f01");
  });
});
