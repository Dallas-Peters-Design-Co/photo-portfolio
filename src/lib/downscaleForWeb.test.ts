import { describe, expect, it } from "vitest";
import { downscaleForWeb } from "./downscaleForWeb";

const pngFile = async (
  width: number,
  height: number,
  name = "cover.png"
): Promise<File> => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("no 2d context");
  }
  // Noise, so the PNG is not trivially compressible and the WebP is smaller.
  const data = ctx.createImageData(width, height);
  for (let i = 0; i < data.data.length; i += 1) {
    data.data[i] = (i * 7919) % 251;
  }
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob"))),
      "image/png"
    )
  );
  return new File([blob], name, { type: "image/png" });
};

const sizeOf = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const size = { height: bitmap.height, width: bitmap.width };
  bitmap.close();
  return size;
};

describe("downscaleForWeb", () => {
  it("shrinks an image wider than 5000 px to 5000 px WebP, keeping its shape", async () => {
    const out = await downscaleForWeb(await pngFile(6000, 300));
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("cover.webp");
    expect(await sizeOf(out)).toEqual({ height: 250, width: 5000 });
  });

  it("returns an image within limits untouched", async () => {
    const file = await pngFile(1200, 800);
    expect(await downscaleForWeb(file)).toBe(file);
  });

  it("leaves non-raster types alone", async () => {
    const svg = new File(
      ["<svg xmlns='http://www.w3.org/2000/svg'/>"],
      "a.svg",
      {
        type: "image/svg+xml",
      }
    );
    expect(await downscaleForWeb(svg)).toBe(svg);
  });
});
