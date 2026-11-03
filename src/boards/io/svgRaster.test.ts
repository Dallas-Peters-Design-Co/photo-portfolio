import { describe, expect, it } from "vitest";
import { isSvgUrl, rasterOf } from "./svgRaster";

const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="200" height="200" fill="#ff0000"/><rect x="200" width="200" height="200" fill="#0000ff"/></svg>'
)}`;

describe("svgRaster", () => {
  it("knows an SVG by its address", () => {
    expect(isSvgUrl("https://x.test/a/mosaic.svg")).toBe(true);
    expect(isSvgUrl("https://x.test/a/mosaic.svg?v=2")).toBe(true);
    expect(isSvgUrl(svg)).toBe(true);
    expect(isSvgUrl("https://x.test/photo.webp")).toBe(false);
  });

  it("draws an SVG once as a bitmap at the width asked, keeping its shape", async () => {
    const src = await rasterOf(svg, 640);
    expect(src?.startsWith("blob:")).toBe(true);
    const img = new Image();
    img.src = src ?? "";
    await img.decode();
    expect([img.naturalWidth, img.naturalHeight]).toEqual([640, 320]);
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 320;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    expect([...ctx.getImageData(100, 100, 1, 1).data]).toEqual([
      255, 0, 0, 255,
    ]);
    expect([...ctx.getImageData(540, 100, 1, 1).data]).toEqual([
      0, 0, 255, 255,
    ]);
    // Asked again, the same bitmap comes back.
    expect(await rasterOf(svg, 640)).toBe(src);
  });

  it("gives up quietly on an SVG with no size of its own", async () => {
    const sizeless = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    )}`;
    const src = await rasterOf(sizeless, 640);
    expect(src === null || src.startsWith("blob:")).toBe(true);
  });
});
