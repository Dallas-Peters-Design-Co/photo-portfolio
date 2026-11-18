import { expect, it } from "vitest";
import { cleanReviewCanvasComponent } from "./reviewCanvasComponent.js";

it("rejects malformed canvas layers before they can enter a review", () => {
  const base = {
    height: 100,
    id: "component",
    layers: [
      {
        body: null,
        config: null,
        fontSize: null,
        height: 100,
        imageUrl: "https://example.com/a.png",
        kind: "photo",
        lid: "layer",
        thumbUrl: null,
        width: 100,
        x: 0,
        y: 0,
      },
    ],
    name: "Title",
    width: 100,
  };
  expect(cleanReviewCanvasComponent(base)?.layers).toHaveLength(1);
  expect(
    cleanReviewCanvasComponent({
      ...base,
      layers: [{ ...base.layers[0], imageUrl: {} }],
    })
  ).toBeNull();
  expect(
    cleanReviewCanvasComponent({
      ...base,
      layers: [{ ...base.layers[0], width: -1 }],
    })
  ).toBeNull();
  expect(
    cleanReviewCanvasComponent({
      ...base,
      layers: [{ ...base.layers[0], kind: "component" }],
    })
  ).toBeNull();
});
