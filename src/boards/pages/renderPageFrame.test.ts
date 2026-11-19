import { expect, it } from "vitest";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import type { PageDesign } from "../../../config/pageDesign.js";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { wiredImageFor } from "../canvas/wiredPreviews";
import { withFrameRenders } from "../io/frameRender";

it("sends the page artwork to the shader and invalidates it after a component changes", async () => {
  const button = {
    ...createConceptElement("button"),
    background: "#ff0000",
    text: "Open",
  };
  const page: PageDesign = {
    boxes: { [button.id]: { height: 60, width: 100, x: 20, y: 30 } },
    concept: { ...createConcept(), background: "#114477", elements: [button] },
    height: 200,
    kitId: null,
    version: 1,
    width: 320,
  };
  const frame: BoardItem = {
    ...BLANK_ITEM,
    config: { pageDesign: page },
    height: 200,
    id: "f",
    kind: "frame",
    width: 320,
    x: 0,
    y: 0,
    z: 0,
  };
  const wires = [
    {
      id: "w",
      sourceItemId: "f",
      sourcePort: "out",
      targetItemId: "s",
      targetPort: "image",
    },
  ];
  const items = await withFrameRenders(
    [frame],
    [frame],
    async (blob) => {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Missing canvas");
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      expect([...ctx.getImageData(10, 10, 1, 1).data]).toEqual([
        17, 68, 119, 255,
      ]);
      expect(
        ctx
          .getImageData(20, 30, 100, 60)
          .data.some(
            (v, i, data) => i % 4 === 0 && v === 255 && data[i + 1] === 0
          )
      ).toBe(true);
      return "https://example.com/art.png";
    },
    (m) => {
      throw new Error(m);
    }
  );
  expect(wiredImageFor("s", { items, wires })).toBe(
    "https://example.com/art.png"
  );
  const edited = {
    ...items[0],
    config: {
      ...items[0].config,
      pageDesign: { ...page, concept: { ...page.concept, elements: [] } },
    },
  };
  expect(wiredImageFor("s", { items: [edited], wires })).toBeNull();
});
