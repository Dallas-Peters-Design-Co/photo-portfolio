import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";

vi.mock("../../services/portfolioService", async (original) => ({
  ...(await original<typeof import("../../services/portfolioService")>()),
  portfolioService: {
    uploadImageFile: async () => ({ url: "https://blob/studio.png" }),
  },
}));

const { CreativeEditor } = await import("./CreativeEditor");

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
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
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: k,
        ...init,
      })
    );
  });
const rows = () => [...document.querySelectorAll(".creative__layer-row")];
const kinds = () =>
  latest
    .filter((i) => i.id !== "f")
    .map((i) => (i.config as { tool?: string } | null)?.tool ?? i.kind);

describe("frame editor shortcuts", () => {
  it("adds with single keys", () => {
    render([frame]);
    press("r");
    press("s");
    press("l");
    press("t");
    expect(kinds()).toEqual(["rect", "star", "line", "text"]);
  });

  it("copies and pastes layers, rotates and aligns from the keyboard", () => {
    render([frame, rect("a", 40, 1)]);
    act(() => (rows()[0] as HTMLButtonElement).click());
    press("c", { metaKey: true });
    press("v", { metaKey: true });
    expect(latest).toHaveLength(3);
    press("]");
    const pasted = latest.at(-1);
    expect(pasted?.rotation).toBe(15);
    press("a", { altKey: true, code: "KeyA" });
    expect(latest.at(-1)?.x).toBe(0);
  });

  it("bolds selected text with ⌘B", () => {
    render([frame]);
    press("t");
    press("b", { metaKey: true });
    expect(latest.at(-1)?.textStyle?.weight).toBe(400);
    press("b", { metaKey: true });
    expect(latest.at(-1)?.textStyle?.weight).toBe(700);
  });

  it("opens the shortcut sheet with ? and runs commands from ⌘K", () => {
    render([frame]);
    press("?", { shiftKey: true });
    expect(
      document.querySelector('[aria-label="Frame editor shortcuts"]')
        ?.textContent
    ).toContain("Star");
    press("Escape");
    expect(document.querySelector(".sheet")).toBeNull();
    press("k", { metaKey: true });
    const input = document.querySelector<HTMLInputElement>(
      ".palette__search input"
    );
    expect(input).not.toBeNull();
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, "star");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    });
    expect(kinds()).toEqual(["star"]);
    expect(document.querySelector(".palette")).toBeNull();
  });

  it("reorders layers by dragging them in the list", () => {
    render([frame, rect("a", 40, 1), rect("b", 200, 2), rect("c", 360, 3)]);
    // The list runs front first: c, b, a. Drag a above c.
    const list = rows();
    const a = list[2] as HTMLElement;
    const top = (list[0] as HTMLElement).getBoundingClientRect();
    const from = a.getBoundingClientRect();
    const fire = (type: string, y: number) =>
      act(() => {
        a.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            clientX: from.left + 10,
            clientY: y,
            pointerId: 3,
          })
        );
      });
    fire("pointerdown", from.top + 5);
    fire("pointermove", top.top + 2);
    fire("pointerup", top.top + 2);
    const z = (id: string) => latest.find((i) => i.id === id)?.z ?? 0;
    expect(z("a")).toBeGreaterThan(z("c"));
    expect(z("c")).toBeGreaterThan(z("b"));
  });

  it("opens the Studio for the frame and sets a background behind everything", async () => {
    render([frame, rect("a", 40, 1)]);
    press("S", { shiftKey: true });
    const sizes = document.querySelector<HTMLSelectElement>(
      ".studio__field select"
    );
    expect(sizes?.options[0]?.textContent).toBe("This frame 1080×1080");
    const bg = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Set as background")
    );
    act(() => bg?.click());
    await vi.waitFor(() => expect(latest).toHaveLength(3), { timeout: 8000 });
    const picture = latest.at(-1);
    expect(picture?.imageUrl).toBe("https://blob/studio.png");
    expect([picture?.x, picture?.y, picture?.width, picture?.height]).toEqual([
      0, 0, 540, 540,
    ]);
    expect(picture?.z).toBeLessThan(1);
  });

  it("resizes the side panels by their edges, and hides them with ⌘\\", () => {
    localStorage.removeItem("creative-editor:panels");
    render([frame]);
    const rail = document.querySelector(".creative__rail") as HTMLElement;
    const before = rail.getBoundingClientRect().width;
    const edge = document.querySelector(
      ".creative__splitter--left"
    ) as HTMLElement;
    const x = edge.getBoundingClientRect().left;
    act(() => {
      edge.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: x,
          pointerId: 4,
        })
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: x + 60, pointerId: 4 })
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", { clientX: x + 60, pointerId: 4 })
      );
    });
    expect(rail.getBoundingClientRect().width).toBeCloseTo(before + 60, 0);
    press("\\", { metaKey: true });
    expect(document.querySelector(".creative--rail-hidden")).not.toBeNull();
    press("\\", { metaKey: true });
    expect(document.querySelector(".creative--rail-hidden")).toBeNull();
    act(() => {
      document
        .querySelector(".creative__splitter--left")
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(
      document
        .querySelector<HTMLElement>(".creative__rail")
        ?.getBoundingClientRect().width
    ).toBeCloseTo(240, 0);
  });
});
