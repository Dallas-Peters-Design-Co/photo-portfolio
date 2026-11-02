import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawTool } from "../../../boards/drawing/drawing";
import { requestHistory } from "../../../boards/hooks/historyRequest";
import { useBoardHistory } from "../../../boards/hooks/useBoardHistory";
import type { Board, BoardItem, BoardWire } from "../../../types";

/**
 * Undo and redo through the real board document, from a click on a button
 * (as the frame editor's Undo is) and from ⌘Z.
 *
 * The narrower test (undoKey.test) drives the window events with a hand-made
 * `change`, and passed while undo did nothing in the app: the history was read
 * and restored inside nested state updaters, and when React ran those eagerly
 * the outer update put the old board straight back.
 */

const loaded = {
  id: "b1",
  items: [{ height: 10, id: "a", kind: "text", width: 10, x: 0, y: 0, z: 1 }],
  sources: [],
  title: "Board",
  wires: [],
};

vi.mock("../../../services/portfolioService", () => ({
  authStorage: { getToken: () => "t", getUser: () => null },
  boardsApi: {
    flush: async () => null,
    get: async () => loaded,
    update: async () => loaded,
  },
  portfolioService: { getPhotos: async () => [] },
}));
vi.mock("../../../services/comments", () => ({
  commentsApi: { list: async () => [] },
}));
vi.mock("../ConfirmProvider", () => ({
  useConfirm: () => ({ confirm: async () => true, prompt: async () => null }),
}));

const { useBoardDocument } = await import("./useBoardDocument");

let host: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

let latest: BoardItem[] = [];
let change: (next: BoardItem[]) => void = () => undefined;

function Probe() {
  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [wires, setWires] = useState<BoardWire[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [, setDrawTool] = useState<DrawTool | null>(null);
  const history = useBoardHistory();
  const doc = useBoardDocument({
    board,
    boardId: "b1",
    history,
    isDirty,
    isLoaded,
    items,
    setBoard,
    setComments: () => undefined,
    setDrawTool,
    setIsDirty,
    setIsInserting: () => undefined,
    setIsLoaded,
    setIsPublishing: () => undefined,
    setIsSaving: () => undefined,
    setItems,
    setPhotos: () => undefined,
    setSources: () => undefined,
    setWires,
    sources: [],
    wires,
  } as unknown as Parameters<typeof useBoardDocument>[0]);
  latest = items;
  ({ change } = doc);
  return (
    <>
      <button
        onClick={() => doc.change(items.map((i) => ({ ...i, x: i.x + 100 })))}
        type="button"
      >
        move
      </button>
      <button onClick={() => requestHistory(false)} type="button">
        undo
      </button>
      <button onClick={() => requestHistory(true)} type="button">
        redo
      </button>
    </>
  );
}

const click = (label: string) =>
  act(() => {
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === label)
      ?.click();
  });

const mount = async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Probe />));
  await vi.waitFor(() => expect(latest).toHaveLength(1));
};

const lift = () =>
  act(() => {
    window.dispatchEvent(new PointerEvent("pointerup"));
  });

describe("undo on the board document", () => {
  it("undoes and redoes from buttons", async () => {
    await mount();
    click("move");
    lift();
    click("move");
    lift();
    expect(latest[0]?.x).toBe(200);
    click("undo");
    expect(latest[0]?.x).toBe(100);
    click("undo");
    expect(latest[0]?.x).toBe(0);
    click("redo");
    expect(latest[0]?.x).toBe(100);
  });

  it("undoes with ⌘Z and redoes with ⇧⌘Z", async () => {
    await mount();
    act(() => change(latest.map((i) => ({ ...i, x: 40 }))));
    lift();
    const key = (shiftKey: boolean) =>
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey })
        );
      });
    key(false);
    expect(latest[0]?.x).toBe(0);
    key(true);
    expect(latest[0]?.x).toBe(40);
  });
});
