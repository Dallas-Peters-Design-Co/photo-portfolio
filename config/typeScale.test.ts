import { describe, expect, it } from "vitest";
import { type BrandKitDoc, EMPTY_KIT, sanitizeKitDoc } from "./brandKit.js";
import { designMd } from "./designMd.js";
import {
  fromScan,
  modularScale,
  sanitizeTypeScale,
  scaleCss,
  spacingSteps,
} from "./typeScale.js";

describe("type scale", () => {
  it("builds a modular scale from the body size", () => {
    const styles = modularScale({ base: 16, headWeight: 700, ratio: 1.25 });
    const body = styles.find((s) => s.name === "body");
    const h1 = styles.find((s) => s.name === "h1");
    expect(body).toMatchObject({ face: "body", size: 16, weight: 400 });
    expect(h1?.size).toBe(49);
    expect(h1?.weight).toBe(700);
    expect(h1?.lineHeight).toBeLessThan(body?.lineHeight ?? 0);
    expect(styles.find((s) => s.name === "label")?.case).toBe("uppercase");
  });

  it("keeps sizes, names and spacing in bounds", () => {
    const scale = sanitizeTypeScale({
      spacing: [8, "4", -2, 8, 9999, "x"],
      styles: [
        {
          case: "shout",
          lineHeight: 9,
          name: "H1 Big!",
          size: 2000,
          weight: 50,
        },
        { name: "h1-big", size: 20 },
        { name: "", size: 12 },
      ],
    });
    expect(scale?.styles).toHaveLength(1);
    expect(scale?.styles[0]).toMatchObject({
      case: "none",
      face: "body",
      lineHeight: 3,
      name: "h1-big",
      size: 400,
      weight: 100,
    });
    expect(scale?.spacing).toEqual([4, 8, 512]);
    expect(sanitizeTypeScale({ spacing: [], styles: [] })).toBeNull();
    expect(sanitizeKitDoc({}).typeScale).toBeNull();
  });

  it("reads the scale a website uses from its scan", () => {
    const scale = fromScan({
      components: [],
      rounded: [],
      scannedAt: "",
      spacing: ["24px", "8px", "16px"],
      title: "",
      typography: [
        {
          name: "h1",
          style: {
            fontSize: "64px",
            fontWeight: "700",
            letterSpacing: "-0.02em",
            lineHeight: "1.05",
            textTransform: "uppercase",
          },
        },
        { name: "body", style: { fontSize: "17px", fontWeight: "400" } },
      ],
      url: "https://x.test",
    });
    expect(scale.styles[0]).toMatchObject({
      case: "uppercase",
      face: "headline",
      lineHeight: 1.05,
      size: 64,
      tracking: -0.02,
      weight: 700,
    });
    expect(scale.styles[1]?.face).toBe("body");
    expect(scale.spacing).toEqual([8, 16, 24]);
  });

  it("writes CSS custom properties", () => {
    const css = scaleCss({
      spacing: spacingSteps(8),
      styles: modularScale({ base: 16, headWeight: 700, ratio: 1.2 }),
    });
    expect(css).toContain("--text-body: 1rem;");
    expect(css).toContain("--space-1: 0.25rem;");
  });

  it("states the scale in DESIGN.md instead of the website's sizes", () => {
    const doc: BrandKitDoc = {
      ...EMPTY_KIT,
      palette: [{ name: "Red", role: "", value: "#c63b2e" }],
      typefaces: [
        {
          name: "Public Sans",
          ref: "g:Public Sans",
          role: "body",
          weights: [],
        },
        { name: "Oswald", ref: "g:Oswald", role: "headline", weights: [700] },
      ],
      typeScale: {
        spacing: [4, 8, 16],
        styles: modularScale({ base: 16, headWeight: 700, ratio: 1.25 }),
      },
    };
    const md = designMd({ doc, name: "Test" });
    const front = md.split("---")[1] ?? "";
    expect(front).toContain(
      '  h1:\n    fontFamily: "Oswald"\n    fontSize: 49px'
    );
    expect(front).toContain('  body:\n    fontFamily: "Public Sans"');
    expect(front).toContain("spacing:\n  2xs: 4px\n  xs: 8px\n  sm: 16px");
    expect(front).toContain('typography: "{typography.body}"');
    expect(front).not.toContain("omitted:\n  - spacing");
    expect(md).toContain("- **label** (`{typography.label}`)");
    expect(md).toContain("Spacing steps: 2xs 4px");
  });
});
