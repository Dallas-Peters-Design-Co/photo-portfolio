import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import type { BoardItem } from "../../types";
import { CreativeEditor } from "./CreativeEditor";

const frame = {
  body: "Banner",
  config: null,
  height: 396,
  id: "f",
  kind: "frame",
  width: 1584,
  x: 0,
  y: 0,
  z: 0,
} as unknown as BoardItem;

/**
 * The artboard can be panned at every zoom, the fit included: the stage
 * always has somewhere to scroll, and opens with the artboard in the middle.
 */
it("opens centred and pans each way at the fit and zoomed out", async () => {
  await page.viewport(1440, 900);
  const host = document.createElement("div");
  host.style.cssText = "width:1200px;height:800px";
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <CreativeEditor
        frameId="f"
        items={[frame]}
        onChange={() => undefined}
        onClose={() => undefined}
      />
    )
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 200));
  });
  const stage = document.querySelector(".creative__stage") as HTMLElement;
  const board = document.querySelector(".creative__board") as HTMLElement;
  const middle = () => {
    const s = stage.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    return {
      x: b.left + b.width / 2 - (s.left + s.width / 2),
      y: b.top + b.height / 2 - (s.top + s.height / 2),
    };
  };
  const pans = () => {
    const at = { left: stage.scrollLeft, top: stage.scrollTop };
    stage.scrollBy(300, 200);
    const moved =
      stage.scrollLeft - at.left >= 299 && stage.scrollTop - at.top >= 199;
    stage.scrollBy(-600, -400);
    const back =
      at.left - stage.scrollLeft >= 299 && at.top - stage.scrollTop >= 199;
    stage.scrollTo(at.left, at.top);
    return moved && back;
  };
  // Fitted: centred, and it pans.
  expect(Math.abs(middle().x)).toBeLessThan(2);
  expect(Math.abs(middle().y)).toBeLessThan(2);
  expect(pans()).toBe(true);
  // Zoomed out twice: still pans.
  for (const _ of [1, 2]) {
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "-", metaKey: true })
      );
    });
  }
  expect(pans()).toBe(true);
  // Fit again: back in the middle.
  stage.scrollBy(250, 120);
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "0", metaKey: true })
    );
  });
  expect(Math.abs(middle().x)).toBeLessThan(2);
  expect(Math.abs(middle().y)).toBeLessThan(2);
  act(() => root.unmount());
  host.remove();
});
