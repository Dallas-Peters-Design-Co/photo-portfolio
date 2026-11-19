import { expect, it, vi } from "vitest";
import { checkWire, outputPortsFor } from "../../../config/graph";
import { normalizeTextStyle } from "../../../config/textStyle";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import { portfolioService } from "../../services/portfolioService";
import type { BoardItem } from "../../types";
import { wiredImageFor } from "../canvas/wiredPreviews";
import { draftFrom, newInstance } from "../components/model";
import { rememberComponents } from "../components/store";
import { framesIntoShaders, withFrameRenders } from "./frameRender";
import { currentFrameRender } from "./frameRenderKey";

import { shaderFrameInput } from "./shaderFrameInput";

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Missing canvas context");
  }
  return ctx;
}

it("feeds a shader the Studio background and text inside a placed canvas component", async () => {
  const frame: BoardItem = {
    ...BLANK_ITEM,
    height: 60,
    id: "frame",
    kind: "frame",
    width: 80,
    x: 0,
    y: 0,
    z: 0,
  };
  const source = document.createElement("canvas");
  const paint = context(source);
  paint.fillStyle = "#006699";
  paint.fillRect(0, 0, source.width, source.height);
  const studio: BoardItem = {
    ...frame,
    config: { studio: { tool: "gradient" } },
    id: "studio",
    imageUrl: source.toDataURL(),
    kind: "reference",
  };
  const text: BoardItem = {
    ...frame,
    body: "A",
    fontSize: 14,
    height: 28,
    id: "label",
    kind: "text",
    textStyle: normalizeTextStyle({ background: "#ff3300" }),
    width: 35,
  };
  const def = {
    ...draftFrom([text], frame, "Label"),
    id: "mixed-label",
    kitId: "kit",
    updatedAt: "v1",
  };
  rememberComponents([def]);
  const instance = newInstance(def, { x: 20, y: 15 }, [studio]);
  const shader: BoardItem = { ...frame, id: "shader", kind: "shader", x: 200 };
  const wire = {
    id: "w",
    sourceItemId: frame.id,
    sourcePort: outputPortsFor(frame)[0].key,
    targetItemId: shader.id,
    targetPort: "image",
  };
  const items = [frame, studio, instance, shader];
  expect(checkWire(items, [], wire)).toEqual({ ok: true });
  const renders = framesIntoShaders(items, [wire]);
  expect(renders).toEqual([frame]);
  const rendered = await withFrameRenders(
    renders,
    items,
    async (blob) => {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = context(canvas);
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      expect([...ctx.getImageData(4, 4, 1, 1).data]).toEqual([
        0, 102, 153, 255,
      ]);
      expect([...ctx.getImageData(100, 70, 1, 1).data]).toEqual([
        255, 51, 0, 255,
      ]);
      return "https://example.com/mixed.png";
    },
    (message) => {
      throw new Error(message);
    }
  );
  expect(wiredImageFor(shader.id, { items: rendered, wires: [wire] })).toBe(
    "https://example.com/mixed.png"
  );
  const upload = vi
    .spyOn(portfolioService, "uploadImageFile")
    .mockResolvedValue({ url: "https://example.com/fresh.png" });
  try {
    expect(
      await shaderFrameInput(shader.id, { items: rendered, wires: [wire] })
    ).toBe("https://example.com/mixed.png");
    expect(upload).not.toHaveBeenCalled();
    expect(await shaderFrameInput(shader.id, { items, wires: [wire] })).toBe(
      "https://example.com/fresh.png"
    );
    expect(upload.mock.calls[0][0].type).toBe("image/png");
  } finally {
    upload.mockRestore();
  }
  rememberComponents([
    { ...def, layers: [{ ...def.layers[0], body: "B" }], updatedAt: "v2" },
  ]);
  expect(currentFrameRender(rendered[0], rendered)).toBeNull();
  expect(framesIntoShaders(rendered, [wire])).toEqual([rendered[0]]);
});
