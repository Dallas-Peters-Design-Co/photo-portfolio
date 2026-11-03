import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { usePaintTiles } from "./TilePaint";
import type { StudioValues } from "./types";

let painted = "";

function Probe() {
  const [values, setValues] = useState<StudioValues>({
    columns: 4,
    painted: "",
  });
  painted = String(values.painted);
  const paint = usePaintTiles({
    keyName: "painted",
    onChange: (key, value) => setValues((v) => ({ ...v, [key]: value })),
    size: { h: 400, w: 400 },
    values,
  });
  return (
    <>
      <div
        {...paint.previewProps}
        data-testid="preview"
        style={{ position: "relative" }}
      >
        <img
          alt=""
          height={400}
          src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
          style={{ display: "block", height: 200, width: 400 }}
          width={400}
        />
        {paint.overlay}
      </div>
      {paint.bar}
    </>
  );
}

it("paints the tiles dragged across, fitted like the preview", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Probe />));
  const button = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Paint")
  );
  act(() => button?.click());
  const preview = host.querySelector<HTMLElement>("[data-testid=preview]");
  const img = host.querySelector("img") as HTMLImageElement;
  const r = img.getBoundingClientRect();
  // The 400×400 picture sits 200×200 in the middle of a 400×200 box.
  const at = (x: number, y: number, type: string, buttons: number) =>
    preview?.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        buttons,
        clientX: r.left + 100 + x,
        clientY: r.top + y,
        pointerId: 1,
      })
    );
  act(() => {
    at(10, 10, "pointerdown", 1);
    at(60, 10, "pointermove", 1);
    at(60, 160, "pointermove", 1);
  });
  // Mid-stroke the mosaic isn't rebuilt: the tiles are drawn on the overlay.
  expect(painted).toBe("");
  const overlay = host.querySelector("canvas") as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  // Tile 0,0 sits at 100,0 in the box (the picture is centred), 50 across.
  const pixel = overlay
    .getContext("2d")
    ?.getImageData(125 * dpr, 25 * dpr, 1, 1).data;
  expect(pixel?.[3]).toBe(255);
  act(() => at(60, 160, "pointerup", 0));
  // A fast jump from row 0 to row 3 fills the tiles between.
  expect(painted).toBe(
    "0.0#000000,1.0#000000,1.1#000000,1.2#000000,1.3#000000"
  );
  act(() => root.unmount());
  host.remove();
});
