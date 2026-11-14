import "../../index.css";
import "./Studio.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { flowTool } from "./generators/flow";
import { StudioPreview } from "./StudioPreview";
import { defaultsOf } from "./tools";

const frames = () =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/**
 * A drawn preview stays inside its box however the box is resized: wider
 * than tall, taller than wide, small. It used to grow to its own pixel size
 * and show only its top-left corner.
 */
it("keeps a drawn preview inside its box as the box is resized", async () => {
  const box = document.createElement("div");
  box.className = "studio__preview";
  document.body.append(box);
  const root = createRoot(box);
  act(() =>
    root.render(
      <StudioPreview
        ctx={{ height: 1080, image: null, palette: ["#d9bd1c"], width: 1080 }}
        tool={flowTool}
        values={{ ...defaultsOf(flowTool.params), text: "2027" }}
      />
    )
  );
  for (const [w, h] of [
    [600, 240],
    [300, 500],
    [900, 300],
  ]) {
    box.style.width = `${w}px`;
    box.style.setProperty("--studio-preview-h", `${h}px`);
    // biome-ignore lint/performance/noAwaitInLoops: each size is laid out and checked in turn
    await frames();
    const outer = box.getBoundingClientRect();
    const inner = (
      box.querySelector("canvas") as HTMLCanvasElement
    ).getBoundingClientRect();
    expect(inner.width).toBeLessThanOrEqual(outer.width + 0.5);
    expect(inner.height).toBeLessThanOrEqual(outer.height + 0.5);
    // Centred: as much room on the left as on the right.
    expect(
      Math.abs(inner.left - outer.left - (outer.right - inner.right))
    ).toBeLessThan(1);
  }
  act(() => root.unmount());
  box.remove();
});
