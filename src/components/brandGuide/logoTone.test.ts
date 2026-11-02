import { describe, expect, it } from "vitest";
import { lightnessOf, toneFromName } from "./logoTone";

describe("logo tone", () => {
  it("reads a logo's ink from its visible pixels only", () => {
    const white = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]);
    const navy = new Uint8ClampedArray([16, 32, 80, 255, 255, 255, 255, 0]);
    expect(lightnessOf(white)).toBeCloseTo(1, 2);
    expect(lightnessOf(navy)).toBeLessThan(0.2);
    expect(lightnessOf(new Uint8ClampedArray([9, 9, 9, 0]))).toBeNull();
  });

  it("guesses from the name until the picture is read", () => {
    expect(toneFromName("rolemodel-logo-white.svg", "")).toBe("light");
    expect(toneFromName("logo-color-on-dark.svg", "")).toBe("light");
    expect(toneFromName("rolemodel-logo.svg", "")).toBe("dark");
  });
});
