import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem, BoardWire } from "../../../types";
import { useLiveFrameRenders } from "./useLiveFrameRenders";

/**
 * A designed frame wired into a shader is flattened without a run.
 *
 * Before, only a run rendered a frame, and a shader never runs — so it was
 * handed the topmost picture inside the frame instead of the design.
 */

const uploads: Blob[] = [];
vi.mock("../../../services/portfolioService", () => ({
  portfolioService: {
    uploadImageFile: (file: File) => {
      uploads.push(file);
      return Promise.resolve({
        url: `https://blob.test/frame-${uploads.length}.png`,
      });
    },
  },
}));

const base = (over: Partial<BoardItem>): BoardItem => ({
  body: null,
  config: null,
  creditName: null,
  creditUrl: null,
  fontSize: null,
  height: 100,
  id: "x",
  imageUrl: null,
  kind: "text",
  nodeType: null,
  photoId: null,
  result: null,
  runError: null,
  runState: "idle",
  textStyle: null,
  thumbUrl: null,
  width: 100,
  x: 0,
  y: 0,
  z: 1,
  ...over,
});

const frame = base({
  config: { designed: true },
  height: 300,
  id: "f",
  kind: "frame",
  width: 400,
  x: 0,
  y: 0,
});
const text = base({ body: "Hello", id: "t", kind: "text", x: 20, y: 20, z: 2 });
const shader = base({
  config: { layers: [] },
  id: "s",
  kind: "shader",
  x: 500,
  y: 0,
});
const wire: BoardWire = {
  id: "w",
  sourceItemId: "f",
  sourcePort: "out",
  targetItemId: "s",
  targetPort: "image",
};

function Host({
  items,
  onItems,
  save,
  wires,
}: {
  items: BoardItem[];
  onItems: (items: BoardItem[]) => void;
  save: (o?: { items?: BoardItem[] }) => Promise<void>;
  wires: BoardWire[];
}) {
  const pending = { current: { items, wires } };
  useLiveFrameRenders({
    items,
    pending,
    save,
    setItems: (next) =>
      onItems(typeof next === "function" ? next(items) : next),
    wires,
  });
  return null;
}

describe("a frame feeding a shader", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    uploads.length = 0;
  });

  it("is rendered and the render saved on the frame, once", async () => {
    vi.useFakeTimers();
    const save = vi.fn(() => Promise.resolve());
    const onItems = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <Host
          items={[frame, text, shader]}
          onItems={onItems}
          save={save}
          wires={[wire]}
        />
      )
    );
    expect(uploads).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    expect(uploads).toHaveLength(1);
    const [first] = save.mock.calls[0] as [{ items: BoardItem[] }];
    const rendered = first.items.find((i) => i.id === "f");
    expect(rendered?.config?.renderUrl).toBe("https://blob.test/frame-1.png");
    expect(typeof rendered?.config?.renderKey).toBe("string");
  });

  it("leaves a frame alone when nothing live is wired to it", async () => {
    vi.useFakeTimers();
    const save = vi.fn(() => Promise.resolve());
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <Host
          items={[frame, text, shader]}
          onItems={() => undefined}
          save={save}
          wires={[]}
        />
      )
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    vi.useRealTimers();
    expect(save).not.toHaveBeenCalled();
    expect(uploads).toHaveLength(0);
  });
});
