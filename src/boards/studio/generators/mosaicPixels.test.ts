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
