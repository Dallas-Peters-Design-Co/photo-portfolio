import { describe, expect, it } from "vitest";
import { hexToOklch, oklchToHex } from "../lib/oklch";
import { pickerSeed } from "./ColorWell";
import { isTransparent, NO_FILL } from "./drawing/drawing";

/**
 * Why a fill colour could be picked and never appear.
 *
 * NO_FILL is "#00000000" — a *sentinel* meaning "do not paint", not an alpha
 * anyone chose. Handing it to the picker started the alpha at zero, so every
 * colour picked came back as "#rrggbb00", which isTransparent() reads as no
 * paint. Pinned here because the failure is completely silent.
 */

/** What the OKLCH picker hands back after a pick seeded with `seed`. */
const pickFrom = (seed: string, hue: number) => {
  const start = hexToOklch(seed);
  if (!start) {
    throw new Error("bad seed");
  }
  return oklchToHex({ ...start, c: 0.15, h: hue, l: 0.55 });
};

describe("pickerSeed", () => {
  it("opens opaque when there is no fill yet", () => {
    expect(pickerSeed(NO_FILL)).toBe("#ffffff");
  });

  it("treats any fully transparent value as no fill", () => {
    expect(pickerSeed("#ff000000")).toBe("#ffffff");
  });

  it("leaves an existing colour exactly as it is", () => {
    expect(pickerSeed("#b8442a")).toBe("#b8442a");
    expect(pickerSeed("#b8442a80")).toBe("#b8442a80");
  });

  it("is what makes a picked colour paint at all", () => {
    expect(isTransparent(pickFrom(NO_FILL, 30))).toBe(true);
    const painted = pickFrom(pickerSeed(NO_FILL), 30);
    expect(isTransparent(painted)).toBe(false);
    expect(painted).toHaveLength(7);
  });
});

describe("picked colours", () => {
  it("carry alpha whenever it would otherwise be lost", () => {
    expect(pickFrom("#b8442a80", 30).slice(7)).toBe("80");
  });
});
