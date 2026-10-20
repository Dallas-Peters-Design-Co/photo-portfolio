import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { fitsContent, useAutoHeight } from "./useAutoHeight";

/**
 * A node as tall as what it holds, measured in a real browser.
 *
 * The measurement is the whole feature: a ResizeObserver and offsetHeight,
 * neither of which jsdom implements, so this runs in Chromium like the rest.
 */
let host: HTMLDivElement | null = null;
let root: Root | null = null;

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const node = (height: number): BoardItem =>
  ({
    height,
    id: "n",
    kind: "op",
    nodeType: "video",
    width: 200,
    x: 0,
    y: 0,
  }) as BoardItem;

let latest: BoardItem = node(100);
let grow: (px: number) => void = () => undefined;

function Harness({ readOnly }: { readOnly: boolean }) {
  const [item, setItem] = useState(latest);
  const [content, setContent] = useState(40);
  grow = setContent;
  latest = item;
  const ref = useAutoHeight(item, readOnly, (patch) =>
    setItem((current) => ({ ...current, ...patch }))
  );
  return (
    <div
      ref={ref}
      style={{ height: fitsContent(item, readOnly) ? "auto" : item.height }}
    >
      <div style={{ height: content }} />
    </div>
  );
}

const render = async (readOnly = false) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(<Harness readOnly={readOnly} />);
  await flush();
};

afterEach(() => {
  root?.unmount();
  host?.remove();
  latest = node(100);
});

describe("useAutoHeight", () => {
  it("writes the measured height back onto the item", async () => {
    await render();
    expect(latest.height).toBe(40);
  });

  it("follows the contents as they grow", async () => {
    await render();
    grow(260);
    await flush();
    await flush();
    expect(latest.height).toBe(260);
  });

  it("leaves a published board's box alone", async () => {
    await render(true);
    expect(latest.height).toBe(100);
  });
});
