import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { FrameSlide } from "./FrameSlide";

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    body: null,
    config: null,
    fontSize: null,
    height: 100,
    id: Math.random().toString(36).slice(2),
    imageUrl: null,
    kind: "photo",
    width: 100,
    x: 0,
    y: 0,
    z: 0,
    ...over,
  }) as BoardItem;

it("draws the whole frame, scaled to fit, with its layers in place", () => {
  const host = document.createElement("div");
  host.style.cssText = "width: 600px; height: 400px; display: flex";
  document.body.append(host);
  const frame = item({
    height: 2000,
    kind: "frame",
    width: 1500,
    x: 500,
    y: 500,
  });
  const words = item({
    body: "2027",
    kind: "text",
    width: 800,
    x: 800,
    y: 900,
  });
  const root = createRoot(host);
  act(() => root.render(<FrameSlide frame={frame} layers={[words]} />));
  const fit = host.querySelector<HTMLElement>(".present__frame-fit");
  // 400 / 2000 is the tighter fit.
  expect(fit?.getBoundingClientRect().height).toBeCloseTo(400, 0);
  expect(fit?.getBoundingClientRect().width).toBeCloseTo(300, 0);
  const layer = host.querySelector<HTMLElement>(".present__layer");
  expect(layer?.style.left).toBe("300px");
  expect(layer?.style.top).toBe("400px");
  expect(host.querySelector("textarea")?.value).toBe("2027");
  act(() => root.unmount());
  host.remove();
});
