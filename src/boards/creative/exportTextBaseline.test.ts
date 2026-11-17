import { expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { renderCreative } from "./exportPng";

const STYLE =
  "position:fixed;left:0;top:0;width:400px;height:200px;margin:0;padding:0;border:0;font:700 120px Georgia;line-height:0.9;color:#000;background:transparent;resize:none;overflow:hidden";

/** The lowest row with ink in it, scanning the canvas. */
const inkBottom = (data: ImageData): number => {
  for (let y = data.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < data.width; x += 1) {
      if ((data.data[(y * data.width + x) * 4 + 3] ?? 0) > 128) {
        return y;
      }
    }
  }
  return -1;
};

it("draws text on the line the page sets it on", async () => {
  const field = document.createElement("textarea");
  field.style.cssText = STYLE;
  field.value = "H";
  document.body.append(field);

  // Where the page puts the baseline: a zero-size box sitting on it.
  const probe = document.createElement("div");
  probe.style.cssText = `${STYLE};white-space:pre`;
  probe.innerHTML =
    'H<span style="display:inline-block;width:0;height:0"></span>';
  document.body.append(probe);
  const span = probe.querySelector("span") as HTMLElement;
  const pageBaseline = span.getBoundingClientRect().top;
  probe.remove();

  const item = {
    body: "H",
    height: 200,
    id: "t",
    kind: "text",
    width: 400,
    x: 0,
    y: 0,
  } as BoardItem;
  const blob = await renderCreative(
    { height: 200, width: 400, x: 0, y: 0 },
    [item],
    400,
    () => field
  );
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(400, 200);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  const drawn = inkBottom(ctx.getImageData(0, 0, 400, 200));
  field.remove();

  // An H sits on its baseline: its lowest ink is the line.
  expect(Math.abs(drawn + 1 - pageBaseline)).toBeLessThanOrEqual(2);
});
