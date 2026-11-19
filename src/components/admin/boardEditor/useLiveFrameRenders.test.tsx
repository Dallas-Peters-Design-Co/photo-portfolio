import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wiredImageFor } from "../../../boards/canvas/wiredPreviews";
import type { BoardItem, BoardWire } from "../../../types";
import { useLiveFrameRenders } from "./useLiveFrameRenders";

/**
 * A designed frame wired into a shader is flattened without a run.
 *
 * Before, only a run rendered a frame, and a shader never runs — so it was
 * handed the topmost picture inside the frame instead of the design.
 */

const LOCAL_URL = /^blob:/;
const uploads: Blob[] = [];
let uploadGate: Promise<void> | undefined;
vi.mock("../../../services/portfolioService", () => ({
  portfolioService: {
    uploadImageFile: async (file: File) => {
      uploads.push(file);
      const url = `https://blob.test/frame-${uploads.length}.png`;
      await uploadGate;
      return { url };
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
  const previews = useLiveFrameRenders({
    items,
    pending,
    save,
    setItems: (next) =>
      onItems(typeof next === "function" ? next(items) : next),
    wires,
  });
  return <output>{previews.get(shader.id)}</output>;
}

describe("a frame feeding a shader", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    uploads.length = 0;
    uploadGate = undefined;
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
    const [first] = save.mock.calls[0] as unknown as [{ items: BoardItem[] }];
    const rendered = first.items.find((i) => i.id === "f");
    expect(rendered?.config?.renderUrl).toBe("https://blob.test/frame-1.png");
    expect(typeof rendered?.config?.renderKey).toBe("string");
  });

  it("renders a frame that was never marked designed, too", async () => {
    vi.useFakeTimers();
    const save = vi.fn(() => Promise.resolve());
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const plain = { ...frame, config: null };
    act(() =>
      root?.render(
        <Host
          items={[plain, text, shader]}
          onItems={() => undefined}
          save={save}
          wires={[wire]}
        />
      )
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    expect(uploads).toHaveLength(1);
  });

  it("delivers the edited frame when its design changes during the first save", async () => {
    let finishSave: () => void = () => undefined;
    const firstSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const save = vi
      .fn()
      .mockReturnValueOnce(firstSave)
      .mockResolvedValue(undefined);
    const onItems = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const show = (items: BoardItem[]) =>
      act(() =>
        root?.render(
          <Host items={items} onItems={onItems} save={save} wires={[wire]} />
        )
      );
    show([frame, text, shader]);
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1), {
      timeout: 4000,
    });
    const before = onItems.mock.calls[0][0] as BoardItem[];
    const edited = before.map((i) =>
      i.id === text.id ? { ...i, body: "New artwork" } : i
    );
    show(edited);
    finishSave();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2), {
      timeout: 4000,
    });
    expect(
      wiredImageFor(shader.id, {
        items: onItems.mock.calls[1][0],
        wires: [wire],
      })
    ).toBe("https://blob.test/frame-2.png");
  });

  it("shows the local composite and its next edit while the first upload is blocked", async () => {
    let finish: () => void = () => undefined;
    uploadGate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const save = vi.fn(() => Promise.resolve());
    const onItems = vi.fn();
    host = document.createElement("div");
    root = createRoot(host);
    const show = (layer: BoardItem) =>
      act(() =>
        root?.render(
          <Host
            items={[frame, layer, shader]}
            onItems={onItems}
            save={save}
            wires={[wire]}
          />
        )
      );
    try {
      show(text);
      await vi.waitFor(() => expect(host?.textContent).toMatch(LOCAL_URL));
      const first = host.textContent;
      expect((await (await fetch(first)).blob()).type).toBe("image/png");
      expect(save).not.toHaveBeenCalled();
      uploadGate = undefined;
      show({ ...text, body: "Second version" });
      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(host.textContent).toMatch(LOCAL_URL);
      expect(host.textContent).not.toBe(first);
      expect(onItems.mock.calls[0][0][0].config.renderUrl).toBe(
        "https://blob.test/frame-2.png"
      );
    } finally {
      finish();
    }
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
