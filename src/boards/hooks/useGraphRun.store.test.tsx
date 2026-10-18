import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";

/**
 * The run outlives the editor: two nodes at once, and a result that lands while
 * the board is closed shows up when it is opened again.
 *
 * Each runNode call waits on a promise the test resolves, so the order of
 * events is the test's to choose rather than the network's.
 */
const pending: Record<string, ((value: unknown) => void) | undefined> = {};
vi.mock("../../services/portfolioService", () => ({
  boardsApi: {
    runNode: (_board: string, itemId: string) =>
      new Promise((resolve) => {
        pending[itemId] = resolve;
      }),
  },
}));

const { useGraphRun } = await import("./useGraphRun");

const node = (id: string): BoardItem =>
  ({
    body: null,
    config: {},
    height: 100,
    id,
    kind: "op",
    nodeType: "generate",
    result: null,
    runError: null,
    runState: "idle",
    width: 100,
    x: 0,
    y: 0,
    z: 1,
  }) as unknown as BoardItem;

const done = (itemId: string) => ({
  itemId,
  result: { url: `https://x.test/${itemId}.png` },
  runError: null,
  runState: "succeeded",
  skipped: false,
  variationCount: 1,
});

let api: ReturnType<typeof useGraphRun> | null = null;
let shown: BoardItem[] = [];

function Editor({ boardId }: { boardId: string }) {
  const [items, setItems] = useState<BoardItem[]>([node("a"), node("b")]);
  shown = items;
  api = useGraphRun({
    beforeRun: async () => undefined,
    boardId,
    items,
    onPatch: (id, patch) =>
      setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    wires: [],
  });
  return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const mount = async (boardId: string) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(<Editor boardId={boardId} />);
  });
};
const unmount = async () => {
  await act(() => root?.unmount());
  host?.remove();
};

afterEach(async () => {
  await unmount();
});

const flush = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe("useGraphRun with the shared run store", () => {
  it("runs two nodes on one board at the same time", async () => {
    await mount("board-concurrent");
    await act(() => {
      void api?.runNode("a", false);
      void api?.runNode("b", false);
    });
    await flush();
    expect(Object.keys(pending)).toEqual(expect.arrayContaining(["a", "b"]));
    expect(api?.isRunning).toBe(true);
    await act(() => {
      pending.a?.(done("a"));
      pending.b?.(done("b"));
    });
    await flush();
    expect(api?.isRunning).toBe(false);
    expect(shown.map((i) => i.runState)).toEqual(["succeeded", "succeeded"]);
  });

  it("shows a result that finished while the board was closed", async () => {
    await mount("board-away");
    await act(() => {
      void api?.runNode("a", false);
    });
    await flush();
    await unmount();

    // Lands with nothing open.
    await act(() => {
      pending.a?.(done("a"));
    });
    await flush();

    // Reopened: the freshly loaded items say idle, the replay says otherwise.
    await mount("board-away");
    await flush();
    const a = shown.find((i) => i.id === "a");
    expect(a?.runState).toBe("succeeded");
    expect(a?.result?.url).toBe("https://x.test/a.png");
  });
});
