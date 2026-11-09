import "../../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { recipeOf } from "./types";

vi.mock("../brand/ActiveBrand", () => ({
  useActiveBrand: () => null,
  useBrandSwatches: () => null,
}));

const { StudioPanel } = await import("./StudioPanel");

/** How many different colours the preview holds: 1 is a blank canvas. */
const coloursIn = (canvas: HTMLCanvasElement) => {
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
  const seen = new Set<number>();
  for (let at = 0; at < data.length; at += 4 * 97) {
    seen.add(
      (data[at] ?? 0) * 65_536 + (data[at + 1] ?? 0) * 256 + (data[at + 2] ?? 0)
    );
  }
  return seen.size;
};

const signature = (canvas: HTMLCanvasElement) => canvas.toDataURL();

describe("Liquid Gradients in the Studio panel", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  it("previews live, follows its controls, and adds a PNG that can be reopened", async () => {
    await page.viewport(1200, 900);
    const onAdd = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <StudioPanel
          initialTool="liquid"
          onAdd={onAdd}
          onClose={() => undefined}
        />
      )
    );
    const canvas = host.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    await vi.waitFor(() => expect(coloursIn(canvas)).toBeGreaterThan(20));
    const silk = signature(canvas);

    const look = [...host.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "marble")
    ) as HTMLSelectElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      )?.set;
      set?.call(look, "marble");
      look.dispatchEvent(new Event("change", { bubbles: true }));
      await vi.waitFor(() => expect(signature(canvas)).not.toBe(silk));
    });

    const add = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Add to board")
    );
    await act(async () => {
      add?.click();
      await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    });
    const [file, recipe] = onAdd.mock.calls[0] as [File, unknown];
    expect(file.type).toBe("image/png");
    expect(file.name).toBe("liquid-1080x1080.png");
    const picture = await createImageBitmap(file);
    expect([picture.width, picture.height]).toEqual([1080, 1080]);
    // What it was made with rides along, so the layer opens in the Studio again.
    const kept = recipeOf({ studio: recipe });
    expect(kept?.tool).toBe("liquid");
    expect(kept?.values.look).toBe("marble");
  });
});
