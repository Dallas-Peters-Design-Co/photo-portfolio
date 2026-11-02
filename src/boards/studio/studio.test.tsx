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
        { ...values, brand: true },
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
});

describe("StudioPanel", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  it("adds the chosen tool's image to the board as a PNG at the size picked", async () => {
    const onAdd = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <StudioPanel
          initialTool="pattern"
          onAdd={onAdd}
          onClose={() => undefined}
        />
      )
    );
    expect(host.querySelector('[aria-pressed="true"]')?.textContent).toBe(
      "Pattern Studio"
    );
    const add = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Add to board")
    );
    await act(async () => {
      add?.click();
      await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    });
    const file = onAdd.mock.calls[0]?.[0] as File;
    expect(file.type).toBe("image/png");
    expect(file.name).toBe("pattern-1080x1080.png");
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
