import { expect, it } from "vitest";
import { svgToPngBlob } from "../render";
import { defaultsOf } from "../tools";
import { lineWavesTool } from "./lineWaves";

it("keeps only ink when hidden ridges are drawn on a transparent background", async () => {
  const ctx = { height: 80, image: null, palette: ["#ffffff"], width: 100 };
  const v = {
    ...defaultsOf(lineWavesTool.params),
    amplitude: 3,
    fill: false,
    hidden: true,
    ink: "#ffffff",
    lines: 7,
  };
  const canvas = document.createElement("canvas");
  canvas.width = ctx.width;
  canvas.height = ctx.height;
  const g = canvas.getContext("2d");
  if (!g) {
    throw new Error("Missing canvas");
  }
  const checkInk = () => {
    const { data } = g.getImageData(0, 0, ctx.width, ctx.height);
    let clear = 0;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) {
        clear += 1;
      } else if (data[i] > 240) {
        ink += 1;
      }
    }
    expect(clear).toBeGreaterThan(ctx.width);
    expect(ink).toBeGreaterThan(ctx.width);
    expect(ink + clear).toBe(ctx.width * ctx.height);
  };
  lineWavesTool.draw?.(g, v, ctx);
  checkInk();
  const blob = await svgToPngBlob(
    lineWavesTool.render(v, ctx),
    ctx.width,
    ctx.height
  );
  const image = await createImageBitmap(blob);
  g.clearRect(0, 0, ctx.width, ctx.height);
  g.drawImage(image, 0, 0);
  image.close();
  checkInk();
});
