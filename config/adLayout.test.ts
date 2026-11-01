import { describe, expect, it } from "vitest";
import {
  AD_SIZES,
  frameBoxFor,
  groupFromTitle,
  inferPin,
  type LayoutItem,
  relayout,
  sizeFromTitle,
  sizeTitle,
} from "./adLayout";

// A 540×540 square ad (1080×1080 at half scale) at (1000, 1000).
const frame = { height: 540, width: 540, x: 1000, y: 1000 };
const item = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number | null = null
): LayoutItem => ({
  fontSize,
  height: h,
  id,
  kind: fontSize ? "text" : "photo",
  width: w,
  x: frame.x + x,
  y: frame.y + y,
});

const photo = item("photo", 0, 0, 540, 540);
const logo = item("logo", 20, 20, 80, 40);
const headline = item("headline", 120, 230, 300, 80, 48);
const cta = item("cta", 400, 470, 120, 50, 20);

describe("inferPin", () => {
  it("reads pins from where things sit", () => {
    expect(inferPin(photo, frame)).toEqual({ h: "stretch", v: "stretch" });
    expect(inferPin(logo, frame)).toEqual({ h: "left", v: "top" });
    expect(inferPin(headline, frame)).toEqual({ h: "center", v: "center" });
    expect(inferPin(cta, frame)).toEqual({ h: "right", v: "bottom" });
  });
});

describe("relayout", () => {
  // Square to Story: 540×960.
  const story = { height: 960, width: 540, x: 2000, y: 1000 };
  const [p, l, h, c] = relayout(frame, story, [photo, logo, headline, cta]);

  it("keeps a full-bleed photo full-bleed", () => {
    expect(p).toMatchObject({ height: 960, width: 540, x: 2000, y: 1000 });
  });

  it("keeps corners in their corners", () => {
    expect(l).toMatchObject({ height: 40, width: 80, x: 2020, y: 1020 });
    expect(c?.x).toBe(story.x + story.width - 20 - 120);
    expect(c?.y).toBe(story.y + story.height - 20 - 50);
  });

  it("keeps the centred headline centred, at the same size", () => {
    expect(h?.x).toBe(2120);
    expect((h?.y ?? 0) + (h?.height ?? 0) / 2).toBe(story.y + story.height / 2);
    expect(h?.fontSize).toBe(48);
  });

  it("scales type and boxes down for a smaller ad", () => {
    const small = { height: 135, width: 270, x: 0, y: 0 }; // half width, quarter height
    const [, , hh] = relayout(frame, small, [photo, logo, headline]);
    expect(hh?.fontSize).toBe(12); // 48 × 0.25
    expect(hh?.width).toBe(75);
  });

  it("honours a pin someone set", () => {
    const [moved] = relayout(frame, story, [headline], {
      headline: { h: "left", v: "top" },
    });
    expect(moved).toMatchObject({ x: 2120, y: 1230 });
  });

  it("clamps fonts", () => {
    const tiny = { height: 54, width: 54, x: 0, y: 0 };
    const [t] = relayout(frame, tiny, [headline], {}, { minFont: 8 });
    expect(t?.fontSize).toBe(8);
  });
});

describe("sizes", () => {
  it("names a frame by its size and reads it back", () => {
    const size = AD_SIZES.find((s) => s.id === "ig-story");
    if (!size) {
      throw new Error("missing size");
    }
    expect(sizeTitle(size)).toBe("Instagram · Story / Reel · 1080×1920");
    expect(sizeFromTitle(sizeTitle(size))).toEqual({ h: 1920, w: 1080 });
    expect(sizeFromTitle("Moodboard")).toBeNull();
  });

  it("keeps the scale of the frame it came from", () => {
    expect(
      frameBoxFor(
        { h: 1920, w: 1080 },
        { ...frame, body: "Instagram · Post · square · 1080×1080" }
      )
    ).toEqual({ height: 960, width: 540 });
    expect(frameBoxFor({ h: 630, w: 1200 }, { ...frame, body: "" })).toEqual({
      height: 315,
      width: 600,
    });
  });
});

describe("groupFromTitle", () => {
  it("reads what a sized frame is for from its title", () => {
    const slide = AD_SIZES.find((s) => s.id === "deck-wide");
    const email = AD_SIZES.find((s) => s.id === "email-full");
    expect(slide && groupFromTitle(sizeTitle(slide))).toBe("Deck");
    expect(email && groupFromTitle(sizeTitle(email))).toBe("Email");
    expect(groupFromTitle("Moodboard")).toBe("");
    expect(groupFromTitle(null)).toBe("");
  });
});
