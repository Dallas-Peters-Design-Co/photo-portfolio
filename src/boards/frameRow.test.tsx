import "../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { BoardItem } from "../types";
import { FrameOpenProvider } from "./FrameOpenContext";
import { FrameBody } from "./itemBodies";

/**
 * Zoomed out, a frame's Copy link sits on the frame's own title row, not a
 * frame's width in screen pixels away across the canvas.
 */
it("keeps Copy link on the frame when zoomed out", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const scale = 0.06;
  // The canvas scales everything inside it; the frame is 1200 units wide.
  host.innerHTML =
    '<div id="canvas" style="transform:scale(0.06);transform-origin:0 0;position:absolute;left:0;top:0"><div id="frame" style="width:1200px;height:900px"></div></div>';
  const frame = host.querySelector("#frame") as HTMLElement;
  const root = createRoot(frame);
  act(() =>
    root.render(
      <FrameOpenProvider linkFor={() => "https://example.test/f"}>
        <FrameBody
          chromeScale={{ transform: `scale(${1 / scale})` }}
          item={{ body: "Frame", id: "f", kind: "frame" } as BoardItem}
          onEditBody={() => undefined}
          readOnly={false}
        />
      </FrameOpenProvider>
    )
  );
  const link = host.querySelector(".frame-body__link") as HTMLElement;
  const box = frame.getBoundingClientRect();
  const r = link.getBoundingClientRect();
  // Within a short reach of the frame's drawn right edge (72px wide here),
  // not ~1200px away.
  expect(r.left).toBeLessThan(box.right + 200);
  act(() => root.unmount());
  host.remove();
});
