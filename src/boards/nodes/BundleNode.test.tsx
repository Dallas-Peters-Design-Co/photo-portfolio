import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import { BOARD_IMAGE_TYPE } from "../itemOutput";
import { BundleNode } from "./BundleNode";

/**
 * Putting a picture straight onto a Bundle, in a real browser.
 *
 * The drop is the part that matters: it has to land on the node and stop
 * there. Left to bubble, the board places the same picture on the canvas too.
 */
let host: HTMLDivElement | null = null;
let root: Root | null = null;

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const bundle = (images: string[]): BoardItem =>
  ({
    config: { images },
    height: 10,
    id: "b",
    kind: "op",
    nodeType: "bundle",
    width: 200,
    x: 0,
    y: 0,
  }) as unknown as BoardItem;

const render = async (
  item: BoardItem,
  onConfigChange: (config: Record<string, unknown>) => void,
  onBoardDrop: () => void
) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  // The board's own drop handler is a React one on the canvas surface, so the
  // stand-in is too: a native listener would see the event whatever React did.
  root.render(
    // biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for the canvas surface's drop handler
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
    <div onDrop={onBoardDrop}>
      <BundleNode
        clips={[]}
        images={item.config?.images as string[]}
        item={item}
        onConfigChange={onConfigChange}
        readOnly={false}
        text={null}
      />
    </div>
  );
  await flush();
  return host;
};

afterEach(() => {
  root?.unmount();
  host?.remove();
});

const URL_A = "https://example.com/a.jpg";

describe("BundleNode", () => {
  it("keeps a picture dragged out of another node, and stops the drop", async () => {
    const onConfigChange = vi.fn();
    const onBoardDrop = vi.fn();
    const el = await render(bundle([]), onConfigChange, onBoardDrop);
    const zone = el.querySelector(".bundle-node__drop");
    if (!zone) {
      throw new Error("no drop zone rendered");
    }
    const data = new DataTransfer();
    data.setData(BOARD_IMAGE_TYPE, JSON.stringify({ url: URL_A }));
    zone.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: data })
    );
    expect(onConfigChange).toHaveBeenCalledWith({ images: [URL_A] });
    expect(onBoardDrop).not.toHaveBeenCalled();
  });

  it("takes an uploaded picture back off", async () => {
    const onConfigChange = vi.fn();
    const el = await render(bundle([URL_A]), onConfigChange, () => undefined);
    const remove = el.querySelector<HTMLButtonElement>(".bundle-node__remove");
    remove?.click();
    expect(onConfigChange).toHaveBeenCalledWith({ images: [] });
  });

  it("offers a button for the file picker", async () => {
    const el = await render(bundle([]), vi.fn(), () => undefined);
    expect(el.querySelector(".bundle-node__add")?.textContent).toContain(
      "Add images"
    );
  });
});
