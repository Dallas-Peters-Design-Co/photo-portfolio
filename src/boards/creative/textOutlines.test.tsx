import interBold from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import { afterEach, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import type { DrawingConfig } from "../drawing/drawing";
import { shapeGeometry } from "../drawing/shapes";
import { outlineTextLayer } from "./textOutlines";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const layer = (over: Partial<BoardItem> = {}): BoardItem =>
  ({
    body: "Hello outlines, wrapped onto two lines",
    config: null,
    fontSize: 40,
    height: 120,
    id: "t1",
    kind: "text",
    textStyle: {
      align: "center",
      color: "#112233",
      family: "g:Inter",
      italic: null,
      letterSpacing: 0.02,
      lineHeight: 1.2,
      transform: "uppercase",
      weight: 700,
    },
    width: 420,
    x: 10,
    y: 20,
    z: 3,
    ...over,
  }) as BoardItem;

it("turns a text layer into its letters, in place, in its colour", async () => {
  const face = new FontFace("Inter", `url(${interBold})`, { weight: "700" });
  document.fonts.add(await face.load());
  const bytes = await (await fetch(interBold)).arrayBuffer();
  // The server's font endpoint, answered with the same face the page drew.
  const real = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    String(input).includes("outlineFont=")
      ? Promise.resolve(
          new Response(bytes, { headers: { "Content-Type": "font/woff" } })
        )
      : real(input, init)
  );

  const host = document.createElement("div");
  host.style.cssText =
    "position:relative;width:420px;height:120px;background:#fff";
  const box = document.createElement("textarea");
  box.value = layer().body ?? "";
  box.style.cssText =
    "position:absolute;inset:0;width:420px;height:120px;margin:0;padding:0;border:0;resize:none;overflow:hidden;font:700 40px/1.2 Inter;letter-spacing:0.02em;text-transform:uppercase;text-align:center;color:#112233;background:transparent";
  host.append(box);
  document.body.append(host);

  const out = await outlineTextLayer(layer(), box);
  expect(out.kind).toBe("drawing");
  expect({ width: out.width, x: out.x, y: out.y, z: out.z }).toEqual({
    width: 420,
    x: 10,
    y: 20,
    z: 3,
  });
  const config = out.config as unknown as DrawingConfig;
  expect(config.tool).toBe("vector");
  expect(config.fill).toBe("#112233");
  expect(config.d?.startsWith("M")).toBe(true);

  // Drawn where the text was, at any size the layer is stretched to.
  expect(shapeGeometry(config, 840, 240, 0)?.d).not.toBe(
    shapeGeometry(config, 420, 120, 0)?.d
  );
});
