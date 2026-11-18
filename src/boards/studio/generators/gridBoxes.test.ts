import { expect, it } from "vitest";
import { gridBoxesTool } from "./gridBoxes";

const RECT = /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g;

it("never draws a box past the picture's edges, whatever its shape", () => {
  for (const [width, height] of [
    [1080, 1350],
    [1080, 1080],
    [1920, 1080],
    [1000, 700],
  ] as const) {
    const svg = gridBoxesTool.render(
      { boxes: 35, colors: "#2ee6d6", columns: 6, layout: "scatter", seed: 9 },
      { height, image: null, palette: ["#2ee6d6"], width }
    ) as string;
    for (const m of svg.matchAll(RECT)) {
      expect(Number(m[1]) + Number(m[3])).toBeLessThanOrEqual(width + 0.01);
      expect(Number(m[2]) + Number(m[4])).toBeLessThanOrEqual(height + 0.01);
    }
  }
});
