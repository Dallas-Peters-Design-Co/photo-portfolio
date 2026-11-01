import { describe, expect, it } from "vitest";
import { type BrandKitDoc, EMPTY_KIT } from "./brandKit.js";
import { designMd } from "./designMd.js";

const doc: BrandKitDoc = {
  ...EMPTY_KIT,
  logos: [
    {
      clearSpace: 0.5,
      label: "mark-dark.svg",
      minWidth: 24,
      rules: "Never on photos.",
      url: "https://blob/mark.svg",
    },
  ],
  offBrand: ["https://blob/off.jpg"],
  onBrand: ["https://blob/on.jpg"],
  palette: [
    { name: "Flush Mahogany", role: "", value: "#f55c3e" },
    { name: "Parchment", role: "", value: "#efe6d2" },
    { name: "Woodsmoke", role: "ink", value: "#0a1112" },
  ],
  references: [
    {
      body: "Old note.",
      date: "2026-09-01",
      id: "a",
      source: "",
      title: "First",
    },
    {
      body: "Pose changes\neach book.",
      date: "2026-10-30",
      id: "b",
      source: "call",
      title: "Cover pose",
    },
  ],
  typefaces: [
    {
      name: "Alternate Gothic No. 1 D",
      ref: "a:snj7bfs:alternate-gothic-no-1-d",
      role: "title",
      weights: [400],
    },
    {
      name: "Alternate Gothic No. 3 D",
      ref: "a:snj7bfs:alternate-gothic-no-3-d",
      role: "headline",
      weights: [400],
    },
    {
      name: "Public Sans",
      ref: "g:Public Sans",
      role: "body",
      weights: [400, 700],
    },
  ],
  voice: "Mid-century scientific surrealism.",
};

const HEADING = /^## (.+)$/gm;

const md = designMd({ doc, name: "Unruly Chain", version: 17 });

describe("designMd", () => {
  it("puts the tokens in the front matter", () => {
    const front = md.split("---")[1] ?? "";
    expect(front).toContain("version: alpha");
    expect(front).toContain("name: Unruly Chain");
    expect(front).toContain('flush-mahogany: "#f55c3e"');
    expect(front).toContain('ink: "#0a1112"');
    // The face whose role says headline, at the weight it actually has.
    expect(front).toContain(
      "headline:\n    fontFamily: alternate-gothic-no-3-d\n    fontWeight: 400"
    );
    expect(front).toContain("fontFamily: Public Sans");
    expect(front).toContain('backgroundColor: "{colors.flush-mahogany}"');
    expect(front).toContain('textColor: "{colors.ink}"');
  });

  it("keeps the known sections in the spec's order", () => {
    const heads = [...md.matchAll(HEADING)].map((m) => m[1]);
    const known = [
      "Overview",
      "Colors",
      "Typography",
      "Components",
      "Do's and Don'ts",
    ];
    expect(heads.filter((h) => known.includes(h ?? ""))).toEqual(known);
    expect(heads).toEqual(
      expect.arrayContaining(["Logo", "Imagery", "References"])
    );
  });

  it("carries the voice, logo rules, imagery and references, newest first", () => {
    expect(md).toContain("Mid-century scientific surrealism.");
    expect(md).toContain("### mark-dark");
    expect(md).toContain("Keep clear space of 50% of its width");
    expect(md).toContain("- Never on photos.");
    expect(md).toContain("![](https://blob/off.jpg)");
    expect(md.indexOf("Cover pose")).toBeLessThan(md.indexOf("First"));
    expect(md).toContain(
      "[Google Fonts](https://fonts.google.com/specimen/Public+Sans)"
    );
  });

  it("writes the same file for the same kit", () => {
    expect(designMd({ doc, name: "Unruly Chain", version: 17 })).toBe(md);
  });
});
