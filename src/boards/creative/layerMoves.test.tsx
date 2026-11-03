import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Toaster } from "sonner";
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
  it("follows the pointer off the artboard, and lets it leave the design without a notice", async () => {
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
    // Where the pointer took it, not stopped at the edge.
    expect(a?.x ?? 0).toBeGreaterThan(800);
    // Out of the design now, so out of the editor, with nothing popping up.
    expect(document.querySelector('[data-layer-id="a"]')).toBeNull();
    await new Promise((done) => setTimeout(done, 50));
    expect(document.body.textContent).not.toContain("Moved out of the frame");
  });

  it("lets a layer hang half off an edge and stay in the design", () => {
    render([frame, rect("a", 40, 1)]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    const layer = document.querySelector('[data-layer-id="a"]') as Element;
    const board = document.querySelector(".creative__board") as Element;
    const r = layer.getBoundingClientRect();
    const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const scale = board.getBoundingClientRect().width / 540;
    // From x 40 to x 480: 60 of its 100 hang past the right edge.
    const to = { x: from.x + 440 * scale, y: from.y };
    pointer("pointerdown", layer, from);
    pointer("pointermove", board, to, { metaKey: true });
    pointer("pointerup", board, to);
    expect(latest.find((i) => i.id === "a")?.x).toBe(480);
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

describe("several layers selected", () => {
  it("offers the text controls for text, and sets the size on all of them", () => {
    render([frame]);
    press("t");
    press("t");
    press("a", { metaKey: true });
    const size = [...document.querySelectorAll(".creative__field")]
      .find((f) => f.textContent?.startsWith("Size"))
      ?.querySelector("input") as HTMLInputElement;
    expect(size).toBeTruthy();
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    act(() => {
      set?.call(size, "1400");
      size.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      latest.filter((i) => i.kind === "text").map((i) => i.fontSize)
    ).toEqual([1400, 1400]);
  });
});

describe("picture position", () => {
  it("pins which part of a picture stays in view, and keeps it", () => {
    const pic = {
      ...base,
      height: 100,
      id: "p",
      imageUrl: "https://example.test/a.png",
      kind: "reference",
      width: 300,
      x: 20,
      y: 20,
      z: 1,
    } as BoardItem;
    render([frame, pic]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    act(() =>
      (
        document.querySelector(
          '[aria-label="Pin to the top left"]'
        ) as HTMLElement
      ).click()
    );
    expect(
      (latest.find((i) => i.id === "p")?.config as { position?: string } | null)
        ?.position
    ).toBe("top-left");
    const img = document.querySelector(
      '[data-layer-id="p"] img'
    ) as HTMLImageElement;
    expect(img.style.objectPosition).toBe("0% 0%");
  });

  it("switches a picture between cover and contain", () => {
    const pic = {
      ...base,
      height: 100,
      id: "p",
      imageUrl: "https://example.test/a.png",
      kind: "reference",
      width: 300,
      x: 20,
      y: 20,
      z: 1,
    } as BoardItem;
    render([frame, pic]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    const fitButton = (label: string) =>
      [...document.querySelectorAll<HTMLElement>(".creative-fit__option")].find(
        (b) => b.textContent === label
      ) as HTMLElement;
    const img = () =>
      document.querySelector('[data-layer-id="p"] img') as HTMLImageElement;
    expect(img().style.objectFit).toBe("cover");
    act(() => fitButton("Contain").click());
    expect(
      (latest.find((i) => i.id === "p")?.config as { fit?: string } | null)?.fit
    ).toBe("contain");
    expect(img().style.objectFit).toBe("contain");
    act(() => fitButton("Cover").click());
    expect(img().style.objectFit).toBe("cover");
  });
});

describe("zooming the artboard", () => {
  it("zooms in and out from the corner and the keys, and fits again", () => {
    render([frame, rect("a", 40, 1)]);
    const width = () =>
      (
        document.querySelector(".creative__board") as HTMLElement
      ).getBoundingClientRect().width;
    const fitted = width();
    act(() =>
      (
        document.querySelector('[aria-label="Zoom in (⌘+)"]') as HTMLElement
      ).click()
    );
    expect(width()).toBeCloseTo(fitted * 1.25, 0);
    press("=", { metaKey: true });
    expect(width()).toBeCloseTo(fitted * 1.25 * 1.25, 0);
    // Bigger than the stage now, so the stage scrolls rather than clipping.
    press("0", { metaKey: true });
    expect(width()).toBeCloseTo(fitted, 0);
    act(() =>
      (
        document.querySelector('[aria-label="Zoom out (⌘−)"]') as HTMLElement
      ).click()
    );
    expect(width()).toBeCloseTo(fitted / 1.25, 0);
  });

  it("still moves layers by the right amount when zoomed", () => {
    render([frame, rect("a", 40, 1)]);
    act(() =>
      (
        document.querySelector('[aria-label="Zoom in (⌘+)"]') as HTMLElement
      ).click()
    );
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    const layer = document.querySelector('[data-layer-id="a"]') as Element;
    const board = document.querySelector(".creative__board") as Element;
    const r = layer.getBoundingClientRect();
    const from = { x: r.left + 5, y: r.top + 5 };
    const scale = board.getBoundingClientRect().width / 540;
    const to = { x: from.x + 30 * scale, y: from.y };
    pointer("pointerdown", layer, from);
    pointer("pointermove", board, to, { metaKey: true });
    pointer("pointerup", board, to);
    expect(latest.find((i) => i.id === "a")?.x).toBe(70);
  });
});

describe("letting go outside the window", () => {
  it("ends the drag when the mouse comes back with its button up", () => {
    render([frame, rect("a", 40, 1)]);
    act(() =>
      (document.querySelector(".creative__layer-row") as HTMLElement).click()
    );
    const layer = document.querySelector('[data-layer-id="a"]') as Element;
    const board = document.querySelector(".creative__board") as Element;
    const r = layer.getBoundingClientRect();
    const from = { x: r.left + 5, y: r.top + 5 };
    const scale = board.getBoundingClientRect().width / 540;
    const mouse = { buttons: 1, metaKey: true, pointerType: "mouse" };
    pointer("pointerdown", layer, from, { pointerType: "mouse" });
    pointer("pointermove", board, { x: from.x + 50 * scale, y: from.y }, mouse);
    // Released off-screen: no pointerup arrives. Back over the artboard with
    // the button up, the drag finishes where it was.
    pointer(
      "pointermove",
      board,
      { x: from.x + 200 * scale, y: from.y },
      { ...mouse, buttons: 0 }
    );
    expect(latest.find((i) => i.id === "a")?.x).toBe(90);
    pointer(
      "pointermove",
      board,
      { x: from.x + 300 * scale, y: from.y },
      { ...mouse, buttons: 0 }
    );
    expect(latest.find((i) => i.id === "a")?.x).toBe(90);
  });
});
