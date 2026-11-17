import interBold from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import { afterEach, expect, it, vi } from "vitest";
import type { TextStyle } from "../../../config/textStyle.js";
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
  // Only at its real address: a request built wrong once reached the site's
  // page fallback, and the font reader choked on HTML.
  const real = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    String(input).startsWith("/api/brand-kits?") &&
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

it("reads the app's own faces from where they are, not by their CSS name", async () => {
  const bytes = await (await fetch(interBold)).arrayBuffer();
  const asked: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    asked.push(String(input));
    return Promise.resolve(
      new Response(bytes.slice(0), { headers: { "Content-Type": "font/woff" } })
    );
  });
  const box = document.createElement("textarea");
  box.value = "Hi";
  box.style.cssText = "width:200px;height:60px;font:600 40px/1.2 sans-serif";
  document.body.append(box);
  const as = (family: string) =>
    outlineTextLayer(
      layer({
        textStyle: { ...(layer().textStyle as TextStyle), family, weight: 600 },
      }),
      box
    );

  await as("exposure");
  await as("open-sauce-sans");
  await as("figtree");
  expect(asked[0]).toBe("/fonts/Exposure0-Regular.woff");
  expect(asked[1]).toBe(
    "/fonts/open-sauce-sans/open-sauce-sans-latin-600-normal.woff"
  );
  expect(asked[2]).toContain("/api/brand-kits?");
  expect(asked[2]).toContain("outlineFont=p%3Afigtree");
});

it("thickens a one-weight face set bold, as the browser draws it", async () => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/fonts/exposure.css";
  document.head.append(link);
  await new Promise((resolve) => link.addEventListener("load", resolve));
  const convert = async (weight: number) => {
    await document.fonts.load(`${weight} 80px "Exposure[0]"`);
    const box = document.createElement("textarea");
    box.value = "Bold";
    box.style.cssText = `width:300px;height:110px;margin:0;padding:0;border:0;font:${weight} 80px/1.2 'Exposure[0]'`;
    document.body.append(box);
    const out = await outlineTextLayer(
      layer({
        body: "Bold",
        textStyle: {
          ...(layer().textStyle as TextStyle),
          family: "exposure",
          weight,
        },
      }),
      box
    );
    box.remove();
    return out.config as unknown as { stroke: string; strokeWidth: number };
  };
  const bold = await convert(700);
  expect(bold.strokeWidth).toBeCloseTo(80 / 32, 1);
  expect(bold.stroke).toBe("#112233");
  expect((await convert(400)).strokeWidth).toBe(0);
});
