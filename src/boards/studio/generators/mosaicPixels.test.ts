import { expect, it } from "vitest";
import { mosaicTool } from "./mosaic";

/**
 * The Studio previews a mosaic by writing its pixels straight onto a canvas
 * rather than decoding the SVG. The two have to show the same picture: each
 * tile's centre is the same colour in both, painted tiles included.
 */
it.each(["square", "circle", "hex"])(
  "draws the same %s tiles as the SVG it puts on the board",
  async (tile) => {
    const src = document.createElement("canvas");
    src.width = 60;
    src.height = 90;
    const sg = src.getContext("2d") as CanvasRenderingContext2D;
    sg.fillStyle = "#204080";
    sg.fillRect(0, 0, 60, 90);
    sg.fillStyle = "#e0c040";
    sg.fillRect(30, 0, 30, 45);
    const image = await createImageBitmap(src);
    const ctx = {
      height: 900,
      image,
      palette: ["#000000", "#ffffff"],
      width: 600,
    };
    const v = {
      colour: "photo",
      columns: 6,
      gap: 10,
      painted: "0.0#ff0000",
      tile,
    };
    const svgImg = new Image(200, 300);
    svgImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mosaicTool.render(v, ctx))}`;
    await svgImg.decode();
    const a = document.createElement("canvas");
    a.width = 200;
    a.height = 300;
    const ag = a.getContext("2d") as CanvasRenderingContext2D;
    ag.drawImage(svgImg, 0, 0, 200, 300);
    const b = document.createElement("canvas");
    b.width = 200;
    b.height = 300;
    const bg = b.getContext("2d") as CanvasRenderingContext2D;
    mosaicTool.draw?.(bg, v, ctx);
    for (const [col, row] of [
      [0, 0],
      [5, 0],
      [1, 7],
      [4, 8],
    ] as const) {
      const x = Math.round((col + 0.5) * (200 / 6));
      const y = Math.round((row + 0.5) * (200 / 6));
      const pa = [...ag.getImageData(x, y, 1, 1).data];
      const pb = [...bg.getImageData(x, y, 1, 1).data];
      for (let i = 0; i < 4; i += 1) {
        expect(Math.abs((pa[i] ?? 0) - (pb[i] ?? 0))).toBeLessThan(6);
      }
    }
    // A gap stays clear in both.
    expect(bg.getImageData(0, 0, 1, 1).data[3]).toBe(0);
  }
);

/**
 * Every gap the same on screen. Rounding each tile to whole pixels made the
 * gaps alternate between a pixel and nothing at preview sizes.
 */
it("keeps every gap the same width at a preview size", async () => {
  const src = document.createElement("canvas");
  src.width = 10;
  src.height = 10;
  const sg = src.getContext("2d") as CanvasRenderingContext2D;
  sg.fillStyle = "#204080";
  sg.fillRect(0, 0, 10, 10);
  const image = await createImageBitmap(src);
  const ctx = { height: 7200, image, palette: ["#000000"], width: 7200 };
  const c = document.createElement("canvas");
  c.width = 437;
  c.height = 437;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  mosaicTool.draw?.(
    g,
    { colour: "photo", columns: 97, gap: 8, tile: "square" },
    ctx
  );
  const row = g.getImageData(0, 200, 437, 1).data;
  // The see-through amount in each gap, summed: what the eye reads as width.
  const gaps: number[] = [];
  let open = 0;
  for (let x = 0; x < 437; x += 1) {
    const clear = 1 - (row[x * 4 + 3] ?? 0) / 255;
    if (clear > 0.02) {
      open += clear;
    } else if (open > 0) {
      gaps.push(open);
      open = 0;
    }
  }
  expect(gaps.length).toBeGreaterThan(80);
  // The first and last are the half gaps at the picture's edges.
  gaps.shift();
  gaps.pop();
  const spread = Math.max(...gaps) - Math.min(...gaps);
  expect(spread, gaps.map((v) => v.toFixed(2)).join(" ")).toBeLessThan(0.35);
});
