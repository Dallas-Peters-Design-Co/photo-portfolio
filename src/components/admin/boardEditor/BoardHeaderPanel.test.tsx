import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../index.css";
import "../BoardEditor.css";
import { BoardHeaderPanel } from "./BoardHeaderPanel";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  localStorage.removeItem("board-header:position");
  localStorage.removeItem("board-header:collapsed");
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const render = () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <BoardHeaderPanel>
        <button type="button">Present</button>
      </BoardHeaderPanel>
    )
  );
  return host.querySelector(".board-header") as HTMLElement;
};

const pointer = (type: string, el: EventTarget, x: number, y: number) =>
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: y,
      })
    );
  });

describe("BoardHeaderPanel", () => {
  it("collapses to the grip and remembers it", () => {
    const panel = render();
    const fold = panel.querySelector(
      ".board-header__collapse"
    ) as HTMLButtonElement;
    act(() => fold.click());
    expect(panel.textContent).not.toContain("Present");
    expect(localStorage.getItem("board-header:collapsed")).toBe("1");
    act(() => root?.unmount());
    host?.remove();
    expect(render().textContent).not.toContain("Present");
  });

  it("moves by its grip, remembers where, and resets on double-click", () => {
    const panel = render();
    const grip = panel.querySelector(".board-header__grip") as HTMLElement;
    const start = panel.getBoundingClientRect();
    pointer("pointerdown", grip, start.left + 4, start.top + 4);
    pointer("pointermove", window, 104, 204);
    pointer("pointerup", window, 104, 204);
    expect(panel.style.left).toBe("100px");
    expect(panel.style.top).toBe("200px");
    expect(panel.style.right).toBe("auto");
    expect(
      JSON.parse(localStorage.getItem("board-header:position") ?? "{}")
    ).toEqual({ x: 100, y: 200 });
    act(() => {
      grip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(panel.style.left).toBe("");
    expect(localStorage.getItem("board-header:position")).toBeNull();
  });
});
