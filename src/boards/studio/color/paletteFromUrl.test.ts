import { describe, expect, it } from "vitest";
import { paletteFromUrl } from "./harmony";

const HEX = /^#[0-9a-f]{6}$/i;

const twoColourPicture = (): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 20;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#d63a2f";
  ctx.fillRect(0, 0, 20, 20);
  ctx.fillStyle = "#1f3dff";
  ctx.fillRect(20, 0, 20, 20);
  return canvas.toDataURL("image/png");
};

describe("paletteFromUrl", () => {
  it("reads a picture's main colours as hex", async () => {
    const found = await paletteFromUrl(twoColourPicture(), 2);
    expect(found.length).toBeGreaterThan(0);
    for (const hex of found) {
      expect(hex).toMatch(HEX);
    }
  });

  it("rejects what isn't a picture", async () => {
    await expect(paletteFromUrl("data:text/plain,nope", 3)).rejects.toThrow(
      "couldn't be read"
    );
  });
});
