import { expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { renderCreative } from "./exportPng";

/** A contained picture exports whole, with the rest of its box left clear. */
it("exports a contained picture whole, pinned where its position says", async () => {
  const src = document.createElement("canvas");
  src.width = 100;
  src.height = 100;
  const c = src.getContext("2d") as CanvasRenderingContext2D;
  c.fillStyle = "#ff0000";
  c.fillRect(0, 0, 100, 100);
  const url = src.toDataURL("image/png");
  const frame = { height: 100, width: 300, x: 0, y: 0 };
  const pic = {
    body: null,
    config: { fit: "contain", position: "left" },
    fontSize: null,
    height: 100,
    id: "p",
    imageUrl: url,
    kind: "reference",
    thumbUrl: url,
    width: 300,
    x: 0,
    y: 0,
    z: 1,
  } as unknown as BoardItem;
  const blob = await renderCreative(frame, [pic], 300, () => null, "#ffffff");
  const img = await createImageBitmap(blob);
  const out = document.createElement("canvas");
  out.width = 300;
  out.height = 100;
  const ctx = out.getContext("2d") as CanvasRenderingContext2D;
  ctx.drawImage(img, 0, 0);
  const at = (x: number) => [...ctx.getImageData(x, 50, 1, 1).data].slice(0, 3);
  expect(at(50)).toEqual([255, 0, 0]);
  expect(at(250)).toEqual([255, 255, 255]);
});
