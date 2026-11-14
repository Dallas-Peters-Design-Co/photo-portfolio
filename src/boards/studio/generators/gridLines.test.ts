import { expect, it } from "vitest";
import { defaultsOf } from "../tools";
import { flowTool } from "./flow";
import { mosaicTool } from "./mosaic";

/** Grid lines in place of the gap, and crosshairs where they meet. */
const picture = () => {
  const src = document.createElement("canvas");
  src.width = 40;
  src.height = 40;
  const g = src.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#204080";
  g.fillRect(0, 0, 40, 40);
  return createImageBitmap(src);
};

const pixel = (canvas: HTMLCanvasElement, x: number, y: number) => {
  const d = (canvas.getContext("2d") as CanvasRenderingContext2D).getImageData(
    x,
    y,
    1,
    1
  ).data;
  return [d[0], d[1], d[2]];
};

it("draws lines between the tiles and crosshairs where they meet", async () => {
  const ctx = {
    height: 400,
    image: await picture(),
    palette: ["#000"],
    width: 400,
  };
  const v = {
    ...defaultsOf(mosaicTool.params),
    columns: 4,
    crossColour: "#ff0000",
    crosses: true,
    crossSize: 20,
    fill: false,
    lineColour: "#00ff00",
    lines: true,
    lineWidth: 4,
  };
  // The SVG: one path of lines, one of crosshairs, tiles meeting edge to edge.
  const svg = mosaicTool.render(v, ctx);
  expect(svg).toContain('stroke="#00ff00"');
  expect(svg).toContain('stroke="#ff0000"');
  expect(svg).toContain('width="100"');

  // The preview: a line between tiles, a crosshair at the meeting point, and
  // the tile itself in the middle of a cell.
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  mosaicTool.draw?.(
    canvas.getContext("2d") as CanvasRenderingContext2D,
    v,
    ctx
  );
  expect(pixel(canvas, 100, 160)).toEqual([0, 255, 0]);
  expect(pixel(canvas, 100, 100)).toEqual([255, 0, 0]);
  expect(pixel(canvas, 112, 100)).toEqual([255, 0, 0]);
  expect(pixel(canvas, 150, 150)).toEqual([32, 64, 128]);
});

it("gives Systems Flow the same grid", () => {
  const ctx = { height: 300, image: null, palette: ["#d9bd1c"], width: 300 };
  const v = { ...defaultsOf(flowTool.params), columns: 30, lines: true };
  expect(flowTool.render(v, ctx)).toContain('stroke="#ffffff"');
  expect(flowTool.render({ ...v, lines: false }, ctx)).not.toContain("stroke=");
});

it("feathers a mosaic's edges: fewer tiles near where the picture ends", async () => {
  const src = document.createElement("canvas");
  src.width = 40;
  src.height = 40;
  const sg = src.getContext("2d") as CanvasRenderingContext2D;
  sg.fillStyle = "#204080";
  sg.fillRect(0, 0, 40, 40);
  const ctx = {
    height: 400,
    image: await createImageBitmap(src),
    palette: ["#000"],
    width: 400,
  };
  const count = (feather: number) => {
    let edge = 0;
    let middle = 0;
    mosaicTool
      .render(
        { ...defaultsOf(mosaicTool.params), columns: 20, feather, fill: false },
        ctx
      )
      .replace(/<rect x="([\d.]+)" y="([\d.]+)"/g, (_m, x, y) => {
        const c = Number(x) / 20;
        const r = Number(y) / 20;
        const ring = Math.min(c, r, 19 - c, 19 - r);
        if (ring < 1) {
          edge += 1;
        } else if (ring >= 8) {
          middle += 1;
        }
        return "";
      });
    return { edge, middle };
  };
  const hard = count(0);
  const soft = count(6);
  expect(soft.edge).toBeLessThan(hard.edge * 0.6);
  expect(soft.middle).toBe(hard.middle);
});
