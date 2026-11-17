import { describe, expect, it } from "vitest";
import { sanitizeKitDoc } from "../../../config/brandKit.js";
import { relinked, renderComponentPng } from "./logoSync";
import type { BrandComponent } from "./model";

const id = "0f0e0d0c-0b0a-4908-8706-050403020100";

describe("a logo that follows a component", () => {
  it("keeps its link through the kit's cleaning, and drops a bad one", () => {
    const doc = sanitizeKitDoc({
      logos: [
        { componentId: id, label: "Mark", url: "https://x/a.png" },
        { componentId: "nope", label: "Other", url: "https://x/b.png" },
      ],
    });
    expect(doc.logos[0]?.componentId).toBe(id);
    expect(doc.logos[1]?.componentId).toBeUndefined();
  });

  it("takes the component's new picture; other logos stay", () => {
    const logos = [
      {
        clearSpace: 0.5,
        componentId: id,
        label: "Mark",
        minWidth: 24,
        rules: "",
        url: "https://x/old.png",
      },
      {
        clearSpace: 0,
        label: "Plain",
        minWidth: 0,
        rules: "",
        url: "https://x/p.png",
      },
    ];
    const next = relinked(logos, id, "https://x/new.png");
    expect(next.map((l) => l.url)).toEqual([
      "https://x/new.png",
      "https://x/p.png",
    ]);
  });
});

it("draws a component on a clear ground, at twice its size", async () => {
  const component: BrandComponent = {
    height: 40,
    id,
    kitId: id,
    layers: [
      {
        body: null,
        config: {
          fill: "#ff0000",
          opacity: 1,
          radius: 0,
          stroke: "#00000000",
          strokeWidth: 0,
          tool: "rect",
        },
        fontSize: null,
        height: 20,
        imageUrl: null,
        kind: "drawing",
        lid: "a",
        thumbUrl: null,
        width: 20,
        x: 0,
        y: 0,
      },
    ],
    name: "Mark",
    placement: {},
    props: [],
    updatedAt: "",
    width: 80,
  };
  const png = await renderComponentPng(component);
  const bitmap = await createImageBitmap(png);
  expect([bitmap.width, bitmap.height]).toEqual([160, 80]);
  const canvas = new OffscreenCanvas(160, 80);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  expect(ctx.getImageData(10, 10, 1, 1).data[0]).toBeGreaterThan(200);
  expect(ctx.getImageData(150, 70, 1, 1).data[3]).toBe(0);
});
