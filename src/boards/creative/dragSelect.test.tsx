import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Toaster } from "sonner";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import type { BoardItem } from "../../types";
import { CreativeEditor } from "./CreativeEditor";

/**
 * Drag-select in the frame editor, in a real browser: a box drawn from the
 * frame's background or from the stage around the artboard.
 */

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

// A desktop-sized window: the editor's three columns don't fit the default
// phone-sized one, which leaves the artboard column no width at all.
beforeAll(async () => {
  await page.viewport(1440, 900);
});

const base = {
  body: null,
  config: null,
  creditName: null,
  creditUrl: null,
  fontSize: null,
  imageUrl: null,
  nodeType: null,
  photoId: null,
  result: null,
  runError: null,
  runState: null,
  textStyle: null,
  thumbUrl: null,
};
const frame: BoardItem = {
  ...base,
  body: "Instagram · Post · square · 1080×1080",
  height: 540,
  id: "f",
  kind: "frame",
  width: 540,
  x: 0,
  y: 0,
  z: 0,
};
const rect = (id: string, x: number, z: number): BoardItem => ({
  ...base,
  config: {
    fill: "#f55c3e",
    opacity: 1,
    radius: 0,
    stroke: "#00000000",
    strokeWidth: 0,
    tool: "rect",
  },
  height: 100,
  id,
  kind: "drawing",
  width: 100,
  x,
  y: 100,
  z,
});

let latest: BoardItem[] = [];
function Harness({ start }: { start: BoardItem[] }) {
  const [items, setItems] = useState(start);
  latest = items;
  return (
    <>
      <CreativeEditor
        frameId="f"
        items={items}
        onChange={setItems}
        onClose={() => undefined}
      />
      <Toaster />
    </>
  );
}
const render = (start: BoardItem[]) => {
  host = document.createElement("div");
  host.style.cssText = "width:1200px;height:800px";
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness start={start} />));
};
const pointer = (
  type: string,
  target: Element,
  p: { x: number; y: number },
  init: PointerEventInit = {}
) =>
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX: p.x,
        clientY: p.y,
        pointerId: 1,
        ...init,
      })
    );
  });

describe("drag-select", () => {
  const selected = () =>
    [...document.querySelectorAll(".creative__layer--selected")].map((el) =>
      el.getAttribute("data-layer-id")
    );
  // A full-frame background at the back, and two shapes on it.
  const bg = { ...rect("bg", 0, 0), height: 540, width: 540, x: 0, y: 0 };

  it("draws a selection box from the background, and a click picks the background", () => {
    render([frame, bg, rect("a", 40, 1), rect("b", 300, 2)]);
    const board = document.querySelector(".creative__board") as Element;
    const b = board.getBoundingClientRect();
    const scale = b.width / 540;
    const at = (x: number, y: number) => ({
      x: b.left + x * scale,
      y: b.top + y * scale,
    });
    const layer = document.querySelector('[data-layer-id="bg"]') as Element;
    // From the background, across shape a only (the shapes sit at y 100..200).
    pointer("pointerdown", layer, at(10, 10), { buttons: 1 });
    pointer("pointermove", board, at(200, 200), { buttons: 1 });
    pointer("pointerup", board, at(200, 200));
    expect(selected()).toEqual(["a"]);
    // A click on the background, no drag, picks it.
    pointer("pointerdown", layer, at(500, 500), { buttons: 1 });
    pointer("pointerup", board, at(500, 500));
    expect(selected()).toEqual(["bg"]);
  });

  it("draws a selection box from the stage around the artboard", () => {
    render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
    const stage = document.querySelector(".creative__stage") as Element;
    const board = document.querySelector(".creative__board") as Element;
    const b = board.getBoundingClientRect();
    const scale = b.width / 540;
    pointer(
      "pointerdown",
      stage,
      { x: b.left - 20, y: b.top - 20 },
      { buttons: 1 }
    );
    pointer(
      "pointermove",
      board,
      { x: b.left + 520 * scale, y: b.top + 200 * scale },
      { buttons: 1 }
    );
    pointer("pointerup", board, {
      x: b.left + 520 * scale,
      y: b.top + 200 * scale,
    });
    expect(selected().sort()).toEqual(["a", "b"]);
  });

  it("resizes a group of layers from a corner of its box, in proportion", () => {
    render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
    const stage = document.querySelector(".creative__stage") as Element;
    const board = document.querySelector(".creative__board") as Element;
    const b = board.getBoundingClientRect();
    const scale = b.width / 540;
    const at = (x: number, y: number) => ({
      x: b.left + x * scale,
      y: b.top + y * scale,
    });
    pointer(
      "pointerdown",
      stage,
      { x: b.left - 20, y: b.top - 20 },
      { buttons: 1 }
    );
    pointer("pointermove", board, at(520, 300), { buttons: 1 });
    pointer("pointerup", board, at(520, 300));
    // The group spans x 40..400, y 100..200; drag its bottom-right corner
    // from (400, 200) to (220, 150): half the size.
    const handle = document.querySelector(
      ".creative__group-handle.creative__handle--se"
    ) as Element;
    pointer("pointerdown", handle, at(400, 200), { buttons: 1 });
    pointer("pointermove", board, at(220, 150), { buttons: 1 });
    pointer("pointerup", board, at(220, 150));
    const a = latest.find((i) => i.id === "a");
    const bb = latest.find((i) => i.id === "b");
    expect(a).toMatchObject({ height: 50, width: 50, x: 40, y: 100 });
    expect(bb).toMatchObject({ height: 50, width: 50, x: 170, y: 100 });
  });
});
