import { expect, it } from "vitest";
import { defaultsOf } from "../tools";
import { ditherTool } from "./dither";
import { gridBoxesTool } from "./gridBoxes";

/** Dither Grid and Grid Boxes: the two cell tools. */
const ctx = { height: 400, image: null, palette: ["#1e3dff"], width: 400 };
const cells = (svg: string, fill: string) =>
  svg.split(`fill="${fill}"`).length - 1;

it("dithers more cells on as the tone gets brighter", () => {
  const at = (brightness: number) =>
    cells(
      ditherTool.render(
        {
          ...defaultsOf(ditherTool.params),
          brightness,
          columns: 40,
          source: "clouds",
        },
        ctx
      ),
      "#ffffff"
    );
  expect(at(-40)).toBeLessThan(at(0));
  expect(at(0)).toBeLessThan(at(40));
  // Fully lit: every cell (40 across, 40 down).
  expect(at(100)).toBe(1600);
});

it("lays the share of boxes asked for, in the box colour", async () => {
  const src = document.createElement("canvas");
  src.width = 10;
  src.height = 10;
  const image = await createImageBitmap(src);
  const svg = (layout: string) =>
    gridBoxesTool.render(
      {
        ...defaultsOf(gridBoxesTool.params),
        boxes: 25,
        colors: "#ff0000",
        columns: 8,
        layout,
      },
      { ...ctx, image }
    );
  // 8 × 8 cells, a quarter of them boxes.
  expect(cells(svg("scatter"), "#ff0000")).toBe(16);
  expect(cells(svg("blob"), "#ff0000")).toBeGreaterThan(8);
  expect(svg("scatter")).toContain("<image");
});
