import { expect, it } from "vitest";
import { withDpi } from "./pngDensity";

const tinyPng = async (): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("empty"))))
  );
};

it("marks a PNG with its density, and it still opens", async () => {
  const marked = await withDpi(await tinyPng(), 144);
  const bytes = new Uint8Array(await marked.arrayBuffer());
  const text = new TextDecoder("latin1").decode(bytes);
  const at = text.indexOf("pHYs");
  expect(at).toBe(37);
  const view = new DataView(bytes.buffer);
  // 144 DPI is 5669 pixels a metre, on both axes, in metres.
  expect(view.getUint32(at + 4)).toBe(5669);
  expect(view.getUint32(at + 8)).toBe(5669);
  expect(bytes[at + 12]).toBe(1);
  const img = await createImageBitmap(marked);
  expect(img.width).toBe(2);
});

it("leaves what isn't a PNG alone", async () => {
  const other = new Blob(["hello"], { type: "text/plain" });
  expect(await withDpi(other, 144)).toBe(other);
});
