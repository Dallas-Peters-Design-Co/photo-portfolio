import { expect, it } from "vitest";
import { parseStudioRecipe } from "../../../api/_lib/layerConfig";
import { svgToPngBlob } from "./render";
import { defaultsOf, IMAGE_TOOLS } from "./tools";

it("keeps blend and mask selections on every placed generator", () => {
  for (const tool of IMAGE_TOOLS) {
    const values = {
      ...defaultsOf(tool.params),
      artBlend: "multiply",
      artMask: "alpha",
    };
    const recipe = parseStudioRecipe({
      image: "https://example.com/art.png",
      size: { h: 100, w: 100 },
      tool: tool.id,
      values,
    });
    expect(recipe?.values, tool.name).toMatchObject({
      artBlend: "multiply",
      artMask: "alpha",
    });
  }
});

it("composites actual exported pixels with the selected picture", async () => {
  const tool = IMAGE_TOOLS.find((t) => t.id === "gradient");
  if (!tool) {
    throw new Error("Missing gradient");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 3;
  canvas.height = 1;
  const g = canvas.getContext("2d");
  if (!g) {
    throw new Error("Missing canvas");
  }
  g.fillStyle = "#ff0000";
  g.fillRect(0, 0, 1, 1);
  g.fillStyle = "black";
  g.fillRect(1, 0, 1, 1);
  const image = await createImageBitmap(canvas);
  const ctx = { height: 1, image, palette: ["#ffffff", "#ffffff"], width: 3 };
  const pixels = async (v: { artBlend?: string; artMask?: string }) => {
    const svg = tool.render({ ...defaultsOf(tool.params), ...v }, ctx);
    const bitmap = await createImageBitmap(await svgToPngBlob(svg, 3, 1));
    g.clearRect(0, 0, 3, 1);
    g.drawImage(bitmap, 0, 0);
    bitmap.close();
    return [...g.getImageData(0, 0, 3, 1).data];
  };
  try {
    expect((await pixels({ artBlend: "multiply" })).slice(0, 4)).toEqual([
      255, 0, 0, 255,
    ]);
    const alpha = await pixels({ artMask: "alpha" });
    expect([alpha[3], alpha[7], alpha[11]]).toEqual([255, 255, 0]);
    const lum = await pixels({ artMask: "luminance" });
    expect(lum[3]).toBeGreaterThan(0);
    expect(lum[3]).toBeLessThan(255);
    expect([lum[7], lum[11]]).toEqual([0, 0]);
  } finally {
    image.close();
  }
});
