import { describe, expect, it } from "vitest";
import { EMPTY_KIT } from "./brandKit.js";
import { SHADOW_PRESETS } from "./conceptShadow.js";
import type { ConceptStyle } from "./conceptStyle.js";
import { styleFacts, styleLines, styleTitle } from "./conceptStyleFacts.js";
import { designMd } from "./designMd.js";

const primary: ConceptStyle = {
  id: "p",
  kind: "button",
  look: {
    background: "#3538cd",
    borderColor: "transparent",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    hover: { background: "#2d31a6" },
    paddingX: 18,
    paddingY: 11,
    radius: 999,
    shadow: SHADOW_PRESETS.soft,
  },
  name: "Primary",
};

describe("component style facts", () => {
  it("states a style's look plainly, leaving out what it does not set", () => {
    expect(styleTitle(primary)).toBe("Button / Primary");
    expect(styleFacts(primary)).toEqual([
      { color: "#3538cd", label: "Fill", value: "#3538cd" },
      { color: "#ffffff", label: "Text", value: "#ffffff" },
      { label: "Corners", value: "pill" },
      { label: "Padding", value: "11px × 18px" },
      { label: "Type", value: "14px semibold" },
      { label: "Shadow", value: "soft" },
      { label: "Hover", value: "fill #2d31a6" },
    ]);
  });

  it("goes into DESIGN.md as one line per style", () => {
    expect(styleLines([primary])[0]).toBe(
      "- **Button / Primary**: fill #3538cd; text #ffffff; corners pill; padding 11px × 18px; type 14px semibold; shadow soft; hover fill #2d31a6."
    );
    const md = designMd({
      doc: { ...EMPTY_KIT, componentStyles: [primary] },
      name: "Acme",
    } as never);
    expect(md).toContain("## Components");
    expect(md).toContain("**Button / Primary**");
  });
});
