import "../index.css";
import { Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import type { BoardItem } from "../types";
import { BoardCanvas } from "./BoardCanvas";

/**
 * Zooming and panning with the wheel or trackpad move the board on the
 * element itself and tell React once the gesture rests. They used to render
 * the canvas and every item on it for each wheel event.
 */

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
});

const frames = (n = 2): Promise<void> =>
  new Promise((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });

const items = Array.from(
  { length: 40 },
  (_, i) =>
    ({
      body: "Note",
      config: null,
      height: 120,
      id: `n${i}`,
      kind: "note",
      width: 200,
      x: 100 + (i % 8) * 240,
      y: 100 + Math.floor(i / 8) * 160,
      z: i + 1,
    }) as unknown as BoardItem
);

const scaleOf = (layer: HTMLElement) =>
  new DOMMatrix(getComputedStyle(layer).transform).a;

it("zooms on the wheel without rendering, then settles once", async () => {
  let commits = 0;
  host = document.createElement("div");
  host.style.cssText = "width:1200px;height:800px";
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <Profiler
      id="board"
      onRender={() => {
        commits += 1;
      }}
    >
      <BoardCanvas
        boardId="board-glide"
        items={items}
        keyOf={(i) => i.id}
        onChange={() => undefined}
      />
    </Profiler>
  );
  await frames(4);
  const layer = host.querySelector(".board-canvas__layer") as HTMLElement;
  const canvas = layer.parentElement as HTMLElement;
  const before = scaleOf(layer);
  const start = commits;

  for (let i = 0; i < 30; i += 1) {
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: 600,
        clientY: 400,
        ctrlKey: true,
        deltaY: -4,
      })
    );
  }
  // The board has zoomed already, with nothing rendered for it.
  const during = scaleOf(layer);
  expect(during).toBeGreaterThan(before);
  expect(commits).toBe(start);
  // Chrome on the items counter-scales by the same amount.
  expect(Number(layer.style.getPropertyValue("--board-inv-scale"))).toBeCloseTo(
    1 / during,
    5
  );

  await new Promise((r) => setTimeout(r, 400));
  await frames();
  // Told once it rested (and once more as the "moving" hint clears, at most).
  expect(commits - start).toBeGreaterThan(0);
  expect(commits - start).toBeLessThanOrEqual(3);
  expect(scaleOf(layer)).toBeCloseTo(during, 5);
});
