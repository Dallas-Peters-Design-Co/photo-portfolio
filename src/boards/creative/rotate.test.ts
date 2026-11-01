import { describe, expect, it } from "vitest";
import { rotationOf as storedRotation } from "../../../api/_lib/boardItemParse.js";
import { dragAngle, normalizeAngle, toLocal } from "./rotate";

describe("rotation", () => {
  it("keeps angles between -180 and 180, as the server does", () => {
    for (const [given, want] of [
      [350, -10],
      [-190, 170],
      [180, -180],
      [720.04, 0],
      [45.26, 45.3],
    ] as const) {
      expect(normalizeAngle(given)).toBe(want);
      expect(storedRotation(given)).toBe(want);
    }
    expect(storedRotation("90")).toBe(0);
    expect(storedRotation(Number.NaN)).toBe(0);
  });

  it("settles onto square angles, and steps by 15° with Shift", () => {
    const c = { x: 0, y: 0 };
    const up = { x: 0, y: -100 };
    const at = (deg: number) => ({
      x: Math.sin((deg * Math.PI) / 180) * 100,
      y: -Math.cos((deg * Math.PI) / 180) * 100,
    });
    expect(dragAngle(c, up, at(88), 0, false)).toBe(90);
    expect(dragAngle(c, up, at(40), 0, false)).toBe(40);
    expect(dragAngle(c, up, at(40), 0, true)).toBe(45);
    expect(dragAngle(c, up, at(-30), 170, false)).toBe(140);
  });

  it("turns a pointer move into the layer's own axes", () => {
    const { dx, dy } = toLocal(0, 10, 90);
    expect(dx).toBeCloseTo(10);
    expect(dy).toBeCloseTo(0);
    expect(toLocal(3, 4, 0)).toEqual({ dx: 3, dy: 4 });
  });
});

describe("rotated layers in the PNG export", () => {
  it("draws a layer turned about its centre", async () => {
    const { renderCreative } = await import("./exportPng");
    const { BLANK_ITEM } = await import(
      "../../components/admin/boardEditor/placement"
    );
    const bar = {
      ...BLANK_ITEM,
      config: {
        fill: "#ff0000",
        stroke: "#00000000",
        strokeWidth: 0,
        tool: "rect",
      },
      height: 180,
      id: "bar",
      kind: "drawing",
      rotation: 90,
      width: 20,
      x: 90,
      y: 10,
      z: 1,
    } as Parameters<typeof renderCreative>[1][number];
    const blob = await renderCreative(
      { height: 200, width: 200, x: 0, y: 0 },
      [bar],
      200,
      () => null,
      "#ffffff"
    );
    const canvas = new OffscreenCanvas(200, 200);
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(await createImageBitmap(blob), 0, 0);
    const red = (x: number, y: number) =>
      (ctx.getImageData(x, y, 1, 1).data[1] ?? 255) < 50;
    // Upright it ran top to bottom; turned, it runs side to side.
    expect(red(20, 100)).toBe(true);
    expect(red(180, 100)).toBe(true);
    expect(red(100, 20)).toBe(false);
  });
});
