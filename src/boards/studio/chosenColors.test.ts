import { describe, expect, it } from "vitest";
import { colorsOf, paletteFor } from "./chosenColors";
import { gradientTool } from "./generators/gradient";
import { defaultsOf } from "./tools";

const BRAND = ["#f55c3e", "#efe6d2", "#0a4212", "#0a1112"];

describe("picked colours", () => {
  it("start as the brand's first few, and become whatever is picked", () => {
    expect(colorsOf("", BRAND, 3)).toEqual(BRAND.slice(0, 3));
    expect(colorsOf("#112233,nope,#abc", BRAND, 3)).toEqual([
      "#112233",
      "#abc",
    ]);
  });

  it("are what the gradient is drawn with", () => {
    const values = {
      ...defaultsOf(gradientTool.params),
      colors: "#112233,#445566",
    };
    const palette = paletteFor(gradientTool.params, values, BRAND);
    const css = gradientTool.css?.(values, {
      height: 10,
      image: null,
      palette,
      width: 10,
    });
    expect(css).toBe("background: linear-gradient(135deg, #112233, #445566);");
  });
});
