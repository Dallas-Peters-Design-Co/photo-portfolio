import { describe, expect, it } from "vitest";
import { transformImage } from "./imageTransforms";

const source = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 2;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("A real canvas is required");
  }
  context.fillStyle = "#ff0000";
  context.fillRect(0, 0, 2, 2);
  context.fillStyle = "#0000ff";
  context.fillRect(2, 0, 2, 2);
  context.clearRect(3, 1, 1, 1);
  return canvas;
};

const pixel = (canvas: HTMLCanvasElement, x: number, y = 0) =>
  Array.from(canvas.getContext("2d")?.getImageData(x, y, 1, 1).data ?? []);

describe("image toolbar geometry", () => {
  it("mirrors the actual pixels and transparency without changing dimensions", () => {
    const original = source();
    const flipped = transformImage(original, "flip-horizontal", {});
    expect([flipped.width, flipped.height]).toEqual([4, 2]);
    expect(pixel(flipped, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(flipped, 3)).toEqual([255, 0, 0, 255]);
    expect(pixel(flipped, 0, 1)[3]).toBe(0);
    expect(pixel(original, 0)).toEqual([255, 0, 0, 255]);
    const restored = transformImage(flipped, "flip-horizontal", {});
    expect(pixel(restored, 0)).toEqual(pixel(original, 0));
    expect(pixel(restored, 3, 1)).toEqual(pixel(original, 3, 1));
  });

  it("exports only the chosen crop, with its actual pixel dimensions", () => {
    const cropped = transformImage(source(), "crop", {
      crop: { height: 1, width: 0.5, x: 0.5, y: 0 },
    });
    expect([cropped.width, cropped.height]).toEqual([2, 2]);
    expect(pixel(cropped, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(cropped, 1, 1)[3]).toBe(0);
  });

  it("refuses empty or out-of-bounds crops", () => {
    expect(() => transformImage(source(), "crop", {})).toThrow(
      "Choose a crop area"
    );
    expect(() =>
      transformImage(source(), "crop", {
        crop: { height: 1, width: 0.5, x: 0.8, y: 0 },
      })
    ).toThrow("inside the image");
    expect(() =>
      transformImage(source(), "crop", {
        crop: { height: 1, width: 0, x: 0, y: 0 },
      })
    ).toThrow("inside the image");
  });
});
