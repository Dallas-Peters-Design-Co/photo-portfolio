import { expect, it } from "vitest";
import type { DrawingConfig } from "../drawing/drawing";
import { drawShape } from "./exportPaint";

const pixel = (ctx: CanvasRenderingContext2D, x: number, y: number) =>
  [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)].join(",");

it("draws a box's border on only the sides it has, inside the box", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 50;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const config: DrawingConfig = {
    borderSides: ["bottom"],
    fill: "#000000",
    stroke: "#ff0000",
    strokeWidth: 10,
    tool: "rect",
  };
  drawShape(ctx, config, 100, 50, 1);
  expect(pixel(ctx, 50, 45)).toBe("255,0,0");
  expect(pixel(ctx, 50, 5)).toBe("0,0,0");
  expect(pixel(ctx, 3, 25)).toBe("0,0,0");
  expect(pixel(ctx, 97, 25)).toBe("0,0,0");
});
