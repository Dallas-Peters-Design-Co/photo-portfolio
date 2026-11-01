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
    expect(front).toContain('primary: "#f55c3e"');
    expect(front).toContain('ink: "#0a1112"');
    // The face whose role says headline, at the weight it actually has.
    expect(front).toContain(
      "headline:\n    fontFamily: alternate-gothic-no-3-d\n    fontWeight: 400"
    );
    expect(front).toContain("fontFamily: Public Sans");
    expect(front).toContain('backgroundColor: "{colors.primary}"');
    // Every other colour is a block, so no token is left unused.
    expect(front).toContain(
      'block-parchment:\n    backgroundColor: "{colors.parchment}"\n    textColor: "{colors.ink}"'
    );
    expect(front).toContain("omitted:\n  - spacing\n  - rounded");
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

  it("describes the components the website draws, using palette tokens", () => {
    const scanned = designMd({
      doc: {
        ...doc,
        scans: [
          {
            components: [
              {
                count: 6,
                name: "button-primary",
                sample: "Explore the book",
                style: {
                  backgroundColor: "#f55c3e",
                  fontFamily: '"Unruly Sans", Arial',
                  padding: "15px 22px",
                  rounded: "50px",
                  textColor: "#0a1112",
                },
              },
            ],
            rounded: ["50px"],
            scannedAt: "2026-11-01T19:00:00.000Z",
            spacing: ["8px", "16px"],
            title: "Unruly Chain",
            typography: [
              {
                name: "h1",
                style: { fontFamily: '"Unruly Display"', fontSize: "89px" },
              },
              { name: "body", style: { fontSize: "19px", lineHeight: "1.45" } },
            ],
            url: "https://unrulychain.com/",
          },
        ],
        websites: ["https://unrulychain.com/"],
      },
      name: "Unruly Chain",
    });
    const front = scanned.split("---")[1] ?? "";
    expect(front).not.toContain("omitted:");
    expect(front).toContain("rounded:\n  sm: 50px");
    expect(front).toContain("spacing:\n  xs: 8px\n  sm: 16px");
    expect(front).toContain(
      'button-primary:\n    backgroundColor: "{colors.primary}"\n    textColor: "{colors.ink}"\n    rounded: "{rounded.sm}"\n    padding: "15px 22px"'
    );
    expect(front).toContain(
      'h1:\n    fontFamily: "Unruly Display"\n    fontSize: 89px'
    );
    // The kit's body face, at the size the website sets it.
    expect(front).toContain(
      "body:\n    fontFamily: Public Sans\n    fontSize: 19px"
    );
    expect(scanned).toContain("## Layout");
    expect(scanned).toContain(
      "From [unrulychain.com](https://unrulychain.com/), scanned 2026-11-01:"
    );
    expect(scanned).toContain(
      '**button-primary** ("Explore the book"): fill #f55c3e'
    );
  });
});
