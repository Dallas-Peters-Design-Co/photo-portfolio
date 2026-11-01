import { describe, expect, it } from "vitest";
import { formatOklch, hexToOklch, oklchToHex, parseColor } from "./oklch";

describe("oklch", () => {
  it("round-trips hex through OKLCH", () => {
    for (const hex of [
      "#000000",
      "#ffffff",
      "#1e3dff",
      "#0b0f1a",
      "#22c55e",
      "#ff7a00",
      "#80808080",
    ]) {
      const c = hexToOklch(hex);
      expect(c && oklchToHex(c)).toBe(hex);
    }
  });

  it("matches known values", () => {
    const white = hexToOklch("#ffffff");
    expect(white?.l).toBeCloseTo(1, 3);
    expect(white?.c).toBe(0);
    const red = hexToOklch("#ff0000");
    expect(red?.l).toBeCloseTo(0.628, 2);
    expect(red?.c).toBeCloseTo(0.2577, 3);
    expect(red?.h).toBeCloseTo(29.23, 1);
  });

  it("brings an out-of-gamut colour into sRGB by lowering chroma", () => {
    const hex = oklchToHex({ a: 1, c: 0.4, h: 145, l: 0.7 });
    expect(hex).toHaveLength(7);
    expect(hexToOklch(hex)?.h).toBeCloseTo(145, 0);
  });

  it("parses and formats CSS oklch()", () => {
    expect(parseColor("oklch(62.8% 0.258 29.2)")).toMatchObject({
      a: 1,
      c: 0.258,
      h: 29.2,
      l: 0.628,
    });
    expect(parseColor("oklch(0.5 0.1 200 / 50%)")?.a).toBe(0.5);
    expect(formatOklch({ a: 0.5, c: 0.1234, h: 200.04, l: 0.5 })).toBe(
      "oklch(50% 0.123 200 / 0.5)"
    );
    expect(parseColor("nope")).toBeNull();
  });
});
