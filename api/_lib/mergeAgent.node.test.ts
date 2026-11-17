import { describe, expect, it } from "vitest";
import { EMPTY_KIT } from "../../config/brandKit.js";
import { kitBrief, mergeMessage, mergeText } from "./mergeAgent.js";

const kit = (name: string) => ({
  doc: {
    ...EMPTY_KIT,
    palette: [{ name: "Navy", role: "primary", value: "#041045" }],
    typefaces: [
      { name: "Archivo", ref: null, role: "display", weights: [700] },
    ],
    voice: "Plain and warm.",
    websites: ["https://example.com"],
  },
  name,
});

describe("brand merge writeups", () => {
  it("sends each kit's websites, voice, palette and type", () => {
    const brief = kitBrief(kit("RoleModel"));
    expect(brief).toContain("Websites: https://example.com");
    expect(brief).toContain("Voice: Plain and warm.");
    expect(brief).toContain("Navy · primary · #041045");
    expect(brief).toContain("Archivo for display");
  });

  it("lists the options in order, by the names given", () => {
    const message = mergeMessage(kit("A"), kit("B"), ["Absorb", "Endorse"]);
    expect(message).toContain("1. Absorb\n2. Endorse");
  });

  it("keeps the option names as asked, matched by name then by place", () => {
    const text = mergeText(
      {
        brands: [
          { audience: "x", name: "A", summary: "s", voice: "v" },
          { audience: "y", name: "B", summary: "t", voice: "w" },
        ],
        comparison: [{ a: "1", aspect: "Voice", b: "2", takeaway: "t" }],
        options: [
          {
            changes: ["c"],
            how: "h2",
            keeps: [],
            name: "Endorse",
            risks: [],
            summary: "second",
            when: "w",
          },
          {
            changes: [],
            how: "h1",
            keeps: [],
            name: "Absorb it",
            risks: [],
            summary: "first",
            when: "w",
          },
        ],
        outcome: "o",
        overview: "ov",
        recommendation: { option: "Endorse", why: "because" },
        title: "A + B",
      },
      ["Absorb", "Endorse"]
    );
    expect(text.options.map((o) => [o.name, o.summary])).toEqual([
      ["Absorb", "first"],
      ["Endorse", "second"],
    ]);
    expect(text.brands?.[1].name).toBe("B");
    expect(text.recommendation?.option).toBe("Endorse");
    expect(text.generatedAt).not.toBeNull();
  });
});
