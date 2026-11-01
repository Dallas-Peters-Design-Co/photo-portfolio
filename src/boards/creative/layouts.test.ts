import { describe, expect, it } from "vitest";
import { type BrandKitDoc, EMPTY_KIT } from "../../../config/brandKit.js";
import type { BoardItem } from "../../types";
import { checkFrame, contrast } from "./brandCheck";
import { brandFor, buildLayout, DEFAULT_COPY, LAYOUTS } from "./layouts";
import { rolesOf } from "./roles";

const kit: BrandKitDoc = {
  ...EMPTY_KIT,
  logos: [
    {
      clearSpace: 0.25,
      label: "mark",
      minWidth: 60,
      rules: "",
      url: "https://blob/logo.svg",
    },
  ],
  onBrand: ["https://blob/hero.jpg"],
  palette: [
    { name: "cobalt", role: "primary", value: "#1e3dff" },
    { name: "snow", role: "neutral", value: "#f7f7f4" },
    { name: "ink", role: "text", value: "#0b0f1a" },
  ],
  typefaces: [
    {
      name: "Space Grotesk",
      ref: "g:Space Grotesk",
      role: "headline",
      weights: [700],
    },
    { name: "Inter", ref: "g:Inter", role: "body", weights: [400, 600] },
  ],
};

const story = { height: 960, width: 540, x: 0, y: 0 };
const banner = { height: 315, width: 600, x: 0, y: 0 };

const build = (id: (typeof LAYOUTS)[number]["id"], frame = story) => {
  const brand = brandFor(kit, rolesOf(frame, [], kit));
  return buildLayout(id, frame, 1, DEFAULT_COPY, brand) as BoardItem[];
};

describe("layouts", () => {
  it("build every layout inside the frame with the brand's parts", () => {
    for (const { id } of LAYOUTS) {
      for (const frame of [story, banner]) {
        const items = build(id, frame);
        const roles = rolesOf(frame, items, kit);
        expect(roles.headline?.body, id).toBe(DEFAULT_COPY.headline);
        expect(roles.cta?.body, id).toBe(DEFAULT_COPY.cta);
        expect(roles.logo, id).not.toBeNull();
        for (const item of items) {
          expect(item.x, id).toBeGreaterThanOrEqual(frame.x - 1);
          expect(item.x + item.width, id).toBeLessThanOrEqual(
            frame.x + frame.width + 1
          );
        }
      }
    }
  });

  it("set type in the brand's fonts", () => {
    const items = build("split");
    const families = items
      .filter((i) => i.kind === "text")
      .map((i) => i.textStyle?.family);
    expect(new Set(families)).toEqual(new Set(["g:Space Grotesk", "g:Inter"]));
  });
});

describe("brand check", () => {
  it("passes typography, colour and logo on a layout built from the kit", () => {
    const items = build("split");
    const result = checkFrame(story, items, kit, 2);
    expect(result.scores.typography).toBe(10);
    expect(result.scores.colour).toBe(10);
    expect(result.scores.logo).toBe(10);
    expect(result.score).toBeGreaterThan(8);
  });

  it("flags off-brand colour, fonts, low contrast and a missing logo", () => {
    const items = build("centered").filter(
      (i) => i.imageUrl !== "https://blob/logo.svg"
    );
    const text = items.find((i) => i.kind === "text");
    if (!text?.textStyle) {
      throw new Error("no text");
    }
    text.textStyle = { ...text.textStyle, color: "#2a46ff", family: "inter" };
    const result = checkFrame(story, items, kit, 2);
    const messages = result.findings.map((f) => f.message).join("\n");
    expect(messages).toContain("No logo");
    expect(messages).toContain("isn't one of the brand's");
    expect(messages).toContain("Contrast is");
    expect(result.score).toBeLessThan(10);
  });

  it("measures contrast the WCAG way", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});
