import { expect, it } from "vitest";
import { defaultsOf } from "../tools";
import { flowTool } from "./flow";

/**
 * Systems Flow draws the number out of ordered pixels with scatter around
 * it, the same in the preview and in the SVG that goes on the board.
 */
it("draws a number in pixel lanes with scatter around it", async () => {
  const values = { ...defaultsOf(flowTool.params), text: "2" };
  const ctx = {
    height: 1080,
    image: null,
    palette: ["#b89d12", "#d9bd1c", "#f0d43a"],
    width: 720,
  };
  await document.fonts.load('800 100px "DM Sans"').catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = 540;
  canvas.height = 810;
  document.body.append(canvas);
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  flowTool.draw?.(g, values, ctx);
  const { data } = g.getImageData(0, 0, 540, 810);
  let yellow = 0;
  let blue = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r = 0, gr = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
    if (r > 150 && gr > 130 && b < 100) {
      yellow += 1;
    } else if (b > 120 && r < 90) {
      blue += 1;
    }
  }
  // Plenty of the number, and loose pixels besides.
  expect(yellow).toBeGreaterThan(20_000);
  expect(blue).toBeGreaterThan(1000);
  const svg = flowTool.render(values, ctx);
  expect(svg.startsWith("<svg")).toBe(true);
  expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThan(1500);
});
