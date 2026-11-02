import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import type { BoardItem } from "../../types";
import { CreativeEditor } from "./CreativeEditor";
import { layerOpacity, opacityOf, withOpacity } from "./layerOpacity";

/**
 * Layer opacity, ⌥-drag to duplicate, moving layers back to the board and
 * keeping dragged layers on the frame, in a real browser.
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
    <CreativeEditor
      frameId="f"
      items={items}
      onChange={setItems}
      onClose={() => undefined}
    />
  );
}
const render = (start: BoardItem[]) => {
  host = document.createElement("div");
  host.style.cssText = "width:1200px;height:800px";
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness start={start} />));
};
const press = (k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: k, ...init })
    );
  });
const typePercent = (value: string) => {
  const input = document.querySelector(
    '[aria-label="Opacity percent"]'
  ) as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  act(() => {
    set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
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

describe("layer opacity", () => {
  it("reads and writes opacity on text and pictures, never on nodes", () => {
    const words = {
      ...base,
      height: 20,
      id: "t",
      kind: "text",
      width: 50,
      x: 0,
      y: 0,
      z: 1,
    } as BoardItem;
    expect(layerOpacity(words)).toBe(1);
    const faded = { ...words, ...withOpacity(words, 0.333) };
    expect(faded.config).toEqual({ opacity: 0.33 });
    expect(layerOpacity(faded)).toBe(0.33);
    const node = {
      ...words,
      config: { opacity: 0.2 },
      kind: "op",
    } as BoardItem;
    expect(layerOpacity(node)).toBe(1);
    expect(opacityOf(rect("r", 0, 1))).toBe(1);
  });

  it("fades a text layer from the bar", () => {
    render([frame]);
    press("t");
    typePercent("40");
    const text = latest.find((i) => i.kind === "text");
    expect((text?.config as { opacity?: number } | null)?.opacity).toBe(0.4);
    const layer = document.querySelector(
      `[data-layer-id="${text?.id}"]`
    ) as HTMLElement;
    expect(layer.style.opacity).toBe("0.4");
  });

  it("fades every selected layer at once", () => {
    render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
    press("a", { metaKey: true });
    typePercent("50");
    expect(
      latest
        .filter((i) => i.kind === "drawing")
        .map((i) => (i.config as { opacity?: number }).opacity)
    ).toEqual([0.5, 0.5]);
  });
});

describe("⌥-drag", () => {
  it("drops a copy where the drag ends and leaves the original", () => {
    render([frame, rect("a", 40, 1)]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    const layer = document.querySelector('[data-layer-id="a"]') as Element;
    const board = document.querySelector(".creative__board") as Element;
    const r = layer.getBoundingClientRect();
    const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const scale = board.getBoundingClientRect().width / 540;
    const to = { x: from.x + 100 * scale, y: from.y };
    pointer("pointerdown", layer, from);
    pointer("pointermove", board, to, { altKey: true, metaKey: true });
    pointer("pointerup", board, to, { altKey: true });
    const shapes = latest.filter((i) => i.kind === "drawing");
    expect(shapes).toHaveLength(2);
    expect(shapes[0]?.x).toBe(40);
    expect(shapes[1]?.x).toBe(140);
    expect(shapes[1]?.id).not.toBe("a");
  });
});

describe("move to the board", () => {
  it("takes a layer off the frame to a clear spot beside it", () => {
    render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    act(() =>
      (
        document.querySelector(
          '[aria-label="Move to the board (⇧B)"]'
        ) as HTMLElement
      ).click()
    );
    const moved = latest.find((i) => i.id === "b");
    expect(moved?.x).toBeGreaterThanOrEqual(frame.width);
    expect(document.querySelector('[data-layer-id="b"]')).toBeNull();
    expect(document.querySelector('[data-layer-id="a"]')).not.toBeNull();
  });

  it("keeps several layers' layout when moving them together", () => {
    render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
    press("a", { metaKey: true });
    press("B", { shiftKey: true });
    const a = latest.find((i) => i.id === "a");
    const b = latest.find((i) => i.id === "b");
    expect((b?.x ?? 0) - (a?.x ?? 0)).toBe(260);
    expect(a?.x).toBeGreaterThanOrEqual(frame.width);
  });
});

describe("dragging near the edge", () => {
  it("stops with the layer's centre still on the frame, so it stays in the design", () => {
    render([frame, rect("a", 40, 1)]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    const layer = document.querySelector('[data-layer-id="a"]') as Element;
    const board = document.querySelector(".creative__board") as Element;
    const r = layer.getBoundingClientRect();
    const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const scale = board.getBoundingClientRect().width / 540;
    const to = { x: from.x + 900 * scale, y: from.y };
    pointer("pointerdown", layer, from);
    pointer("pointermove", board, to, { metaKey: true });
    pointer("pointerup", board, to);
    const a = latest.find((i) => i.id === "a");
    // Centre at the right edge less a unit: half the layer hangs off.
    expect((a?.x ?? 0) + 50).toBeLessThanOrEqual(540);
    expect((a?.x ?? 0) + 50).toBeGreaterThan(530);
    expect(document.querySelector('[data-layer-id="a"]')).not.toBeNull();
  });

  it("stops arrow-key nudges at the edge too", () => {
    render([frame, rect("a", 440, 1)]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    for (let i = 0; i < 12; i += 1) {
      press("ArrowRight", { shiftKey: true });
    }
    expect(document.querySelector('[data-layer-id="a"]')).not.toBeNull();
  });
});

describe("the bar above the artboard", () => {
  it("stays one height whatever is selected, so the artboard doesn't jump", () => {
    render([frame, rect("a", 40, 1)]);
    const stage = () =>
      (
        document.querySelector(".creative__stage") as HTMLElement
      ).getBoundingClientRect().height;
    const empty = stage();
    press("t");
    expect(stage()).toBe(empty);
    press("a", { metaKey: true });
    expect(stage()).toBe(empty);
  });
});

describe("vertical alignment", () => {
  it("is offered on any text box, with or without a box behind it", () => {
    render([frame]);
    press("t");
    const middle = document.querySelector(
      '[aria-label="Text in the middle"]'
    ) as HTMLElement;
    expect(middle).not.toBeNull();
    act(() => middle.click());
    const text = latest.find((i) => i.kind === "text");
    expect(text?.textStyle?.verticalAlign).toBe("middle");
    expect(text?.textStyle?.background ?? null).toBeNull();
  });
});
