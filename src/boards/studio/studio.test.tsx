import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PALETTE, defaultsOf, IMAGE_TOOLS } from "./tools";

vi.mock("../brand/ActiveBrand", () => ({
  useActiveBrand: () => null,
  useBrandSwatches: () => null,
}));

const { StudioPanel } = await import("./StudioPanel");

const ctx = { height: 400, image: null, palette: DEFAULT_PALETTE, width: 600 };

const rgbOf = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

const parse = (svg: string) =>
  new DOMParser().parseFromString(svg, "image/svg+xml");

describe("Studio generators", () => {
  for (const tool of IMAGE_TOOLS) {
    it(`${tool.name} draws a valid SVG at the size asked, the same for a seed`, () => {
      const values = { ...defaultsOf(tool.params), seed: 42 };
      const svg = tool.render(values, ctx);
      const doc = parse(svg);
      expect(doc.querySelector("parsererror")).toBeNull();
      const root = doc.documentElement;
      expect(root.getAttribute("width")).toBe("600");
      expect(root.getAttribute("height")).toBe("400");
      expect(tool.render(values, ctx)).toBe(svg);
    });
  }

  it("draws every pattern kind and every gradient type", () => {
    const pattern = IMAGE_TOOLS.find((t) => t.id === "pattern");
    const gradient = IMAGE_TOOLS.find((t) => t.id === "gradient");
    for (const kind of [
      "dots",
      "dots-offset",
      "halftone",
      "lines",
      "grid",
      "checks",
      "waves",
      "zigzag",
      "crosses",
    ]) {
      const svg =
        pattern?.render({ ...defaultsOf(pattern.params), kind }, ctx) ?? "";
      expect(parse(svg).querySelector("parsererror")).toBeNull();
    }
    for (const kind of ["linear", "radial", "conic"]) {
      const v = { ...defaultsOf(gradient?.params ?? []), kind };
      expect(
        parse(gradient?.render(v, ctx) ?? "").querySelector("parsererror")
      ).toBeNull();
      expect(gradient?.css?.(v, ctx)).toContain(`${kind}-gradient`);
    }
  });

  it("builds a mosaic from a picture, snapping to the palette when asked", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const c = canvas.getContext("2d") as CanvasRenderingContext2D;
    c.fillStyle = "#ff0000";
    c.fillRect(0, 0, 20, 40);
    c.fillStyle = "#0000ff";
    c.fillRect(20, 0, 20, 40);
    const image = await createImageBitmap(canvas);
    const mosaic = IMAGE_TOOLS.find((t) => t.id === "mosaic");
    const values = { ...defaultsOf(mosaic?.params ?? []), columns: 4, gap: 0 };
    const photo =
      mosaic?.render(values, { ...ctx, height: 400, image, width: 400 }) ?? "";
    expect(photo).toContain('fill="#ff0000"');
    expect(photo).toContain('fill="#0000ff"');
    const snapped =
      mosaic?.render(
        { ...values, colour: "nearest" },
        {
          ...ctx,
          height: 400,
          image,
          palette: ["#ee1111", "#1111ee"],
          width: 400,
        }
      ) ?? "";
    expect(snapped).toContain('fill="#ee1111"');
    expect(snapped).not.toContain('fill="#ff0000"');
  });

  it("paints single tiles over the mosaic's colours, or hides them", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const c = canvas.getContext("2d") as CanvasRenderingContext2D;
    c.fillStyle = "#ff0000";
    c.fillRect(0, 0, 40, 40);
    const image = await createImageBitmap(canvas);
    const mosaic = IMAGE_TOOLS.find((t) => t.id === "mosaic");
    const at = { ...ctx, height: 400, image, width: 400 };
    const values = { ...defaultsOf(mosaic?.params ?? []), columns: 4, gap: 0 };
    // Tile (1, 2) green; tile (3, 0) fully clear, so it isn't drawn.
    const svg =
      mosaic?.render({ ...values, painted: "1.2#00ff00,3.0#ff000000" }, at) ??
      "";
    expect(svg).toContain(
      'x="100" y="200" width="100" height="100" fill="#00ff00"'
    );
    expect(svg).not.toContain('x="300" y="0"');
    expect(svg.match(/fill="#ff0000"/g)).toHaveLength(14);
  });

  it("recolours a mosaic by swapping each of the picture's colours", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const c = canvas.getContext("2d") as CanvasRenderingContext2D;
    c.fillStyle = "#ff0000";
    c.fillRect(0, 0, 20, 40);
    c.fillStyle = "#0000ff";
    c.fillRect(20, 0, 20, 40);
    const image = await createImageBitmap(canvas);
    const mosaic = IMAGE_TOOLS.find((t) => t.id === "mosaic");
    const values = {
      ...defaultsOf(mosaic?.params ?? []),
      colour: "remap",
      columns: 2,
      count: 2,
      gap: 0,
    };
    const at = { ...ctx, height: 400, image, width: 400 };
    // Dark to light: the blue side is the darker of the two.
    const [dark = "", light = ""] = mosaic?.sources?.(values, at) ?? [];
    expect(rgbOf(dark)[2]).toBeGreaterThan(rgbOf(dark)[0]);
    expect(rgbOf(light)[0]).toBeGreaterThan(rgbOf(light)[2]);
    const svg = mosaic?.render({ ...values, remap: "#00ff00," }, at) ?? "";
    expect(svg).toContain('fill="#00ff00"');
    expect(svg).toContain(`fill="${light}"`);
    expect(svg).not.toContain(`fill="${dark}"`);
    // A swap can be see-through, or clear: a clear tile isn't drawn at all.
    const half = mosaic?.render({ ...values, remap: "#00ff0080," }, at) ?? "";
    expect(half).toContain('fill="#00ff00" fill-opacity="0.5"');
    const clear = mosaic?.render({ ...values, remap: "#00ff0000," }, at) ?? "";
    expect(clear).not.toContain("#00ff00");
    expect(parse(clear).querySelectorAll("rect")).toHaveLength(2);
    // The swap list only shows while recolouring.
    const remap = mosaic?.params.find((p) => p.type === "remap");
    expect(remap?.when?.({ ...values, colour: "photo" })).toBe(false);
  });

  it("recolours a mosaic by brightness, banded or blended, and can invert", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 30;
    canvas.height = 10;
    const c = canvas.getContext("2d") as CanvasRenderingContext2D;
    for (const [i, shade] of ["#000000", "#b0b0b0", "#ffffff"].entries()) {
      c.fillStyle = shade;
      c.fillRect(i * 10, 0, 10, 10);
    }
    const image = await createImageBitmap(canvas);
    const mosaic = IMAGE_TOOLS.find((t) => t.id === "mosaic");
    const base = { ...defaultsOf(mosaic?.params ?? []), columns: 3, gap: 0 };
    const draw = (values: Record<string, unknown>) =>
      mosaic?.render(values as typeof base, {
        ...ctx,
        height: 100,
        image,
        // Picked in any order: dark to light is worked out from brightness.
        palette: ["#ddeeff", "#112233"],
        width: 300,
      }) ?? "";
    const fills = (svg: string) =>
      [...parse(svg).querySelectorAll("rect")].map((r) =>
        r.getAttribute("fill")
      );
    expect(fills(draw({ ...base, colour: "tones" }))).toEqual([
      "#112233",
      "#ddeeff",
      "#ddeeff",
    ]);
    const [first] = fills(draw({ ...base, colour: "tones", invert: true }));
    expect(first).toBe("#ddeeff");
    const [, middle] = fills(draw({ ...base, colour: "blend" }));
    expect(middle).not.toBe("#112233");
    expect(middle).not.toBe("#ddeeff");
    // No background unless asked: the tiles are all there is.
    expect(fills(draw({ ...base, colour: "tones" }))).toHaveLength(3);
    expect(fills(draw({ ...base, bg: "#000000", fill: true }))).toHaveLength(4);
  });
});

describe("StudioPanel", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  it("adds a mosaic as the SVG itself, so it stays vector", async () => {
    const onAdd = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <StudioPanel
          initialTool="mosaic"
          onAdd={onAdd}
          onClose={() => undefined}
        />
      )
    );
    const add = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Add to board")
    );
    await act(async () => {
      add?.click();
      await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    });
    const file = onAdd.mock.calls[0]?.[0] as File;
    expect(file.type).toBe("image/svg+xml");
    expect(file.name).toBe("mosaic-1080x1080.svg");
    expect(await file.text()).toContain("<svg");
  });

  const addFrom = async (tool: string): Promise<File> => {
    const onAdd = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <StudioPanel
          initialTool={tool}
          onAdd={onAdd}
          onClose={() => undefined}
        />
      )
    );
    const add = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Add to board")
    );
    await act(async () => {
      add?.click();
      await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    });
    return onAdd.mock.calls[0]?.[0] as File;
  };

  it("adds a vector tool's image to the board as an SVG at the size picked", async () => {
    const file = await addFrom("pattern");
    expect(host?.querySelector('[aria-pressed="true"]')?.textContent).toBe(
      "Pattern Studio"
    );
    expect(file.type).toBe("image/svg+xml");
    expect(file.name).toBe("pattern-1080x1080.svg");
    const svg = new DOMParser().parseFromString(
      await file.text(),
      "image/svg+xml"
    );
    expect(svg.querySelector("parsererror")).toBeNull();
    expect(svg.documentElement.getAttribute("width")).toBe("1080");
    act(() => root?.unmount());
    host?.remove();
  });

  it("adds a tool that only rasterises well as a PNG at the size picked", async () => {
    const file = await addFrom("gradient");
    expect(file.type).toBe("image/png");
    const bitmap = await createImageBitmap(file);
    expect([bitmap.width, bitmap.height]).toEqual([1080, 1080]);
  });

  it("resizes from the preview's corner: the preview grows and the panel with it", () => {
    localStorage.removeItem("studio:size");
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <StudioPanel
          initialTool="gradient"
          onAdd={() => undefined}
          onClose={() => undefined}
        />
      )
    );
    const panel = host.querySelector(".studio") as HTMLElement;
    const preview = host.querySelector(".studio__preview") as HTMLElement;
    const corner = host.querySelector(
      ".studio__corner--preview"
    ) as HTMLElement;
    const before = {
      panel: panel.getBoundingClientRect(),
      preview: preview.getBoundingClientRect().height,
    };
    const at = corner.getBoundingClientRect();
    act(() => {
      corner.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: at.left,
          clientY: at.top,
        })
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: at.left - 100,
          clientY: at.top + 60,
        })
      );
      window.dispatchEvent(new PointerEvent("pointerup", {}));
    });
    expect(preview.getBoundingClientRect().height).toBeCloseTo(
      before.preview + 60,
      0
    );
    expect(panel.getBoundingClientRect().height).toBeGreaterThan(
      before.panel.height
    );
    localStorage.removeItem("studio:size");
    localStorage.removeItem("board-studio:position");
  });
});
