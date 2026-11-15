import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { keepResultWrite } from "../../../boards/run/resultWrites";
import { runStore } from "../../../boards/run/runStore";
import type { BoardItem, BoardItemResult } from "../../../types";
import { BLANK_ITEM } from "./placement";

const deleteVersion =
  vi.fn<(...args: unknown[]) => Promise<BoardItemResult | null>>();
vi.mock("../../../services/portfolioService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../services/portfolioService")
  >()),
  boardsApi: { deleteVersion },
}));
vi.mock("../ConfirmProvider", () => ({
  useConfirm: () => ({ prompt: async () => null }),
}));
const { useBoardItemEdits } = await import("./useBoardItemEdits");

const variation = (url: string) => ({
  description: null,
  height: 100,
  isVector: false,
  url,
  width: 100,
});
const result: BoardItemResult = {
  ...variation("a"),
  fingerprint: "f",
  history: [variation("a"), variation("b"), variation("c")],
  ranAt: "now",
  variations: [],
};
const initial: BoardItem = {
  ...BLANK_ITEM,
  config: { selectedVersion: 2 },
  height: 100,
  id: "node",
  kind: "op",
  result,
  width: 100,
  x: 0,
  y: 0,
  z: 1,
};

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let latest: BoardItem[] = [];
let remove: (itemId: string, index: number) => Promise<void>;
let patch: (fields: Partial<BoardItem>) => void;

function Harness({ boardId = "delete-race" }: { boardId?: string }) {
  const [items, setItems] = useState([initial]);
  latest = items;
  patch = (fields) =>
    setItems((current) => current.map((item) => ({ ...item, ...fields })));
  remove = useBoardItemEdits({
    boardId,
    change: setItems,
    items,
    navigate: () => undefined,
    setDrawTool: () => undefined,
    setIsDirty: () => undefined,
    setItems,
    wires: [],
  }).removeVersion;
  return null;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  deleteVersion.mockReset();
});

it("keeps both deletions and a new generation when responses arrive out of order", async () => {
  let first: (value: BoardItemResult | null) => void = () => undefined;
  let second: (value: BoardItemResult | null) => void = () => undefined;
  deleteVersion.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        first = resolve;
      })
  );
  deleteVersion.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        second = resolve;
      })
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness />));
  const pendingA = remove("node", 0);
  const pendingB = remove("node", 1);
  await vi.waitFor(() => expect(deleteVersion).toHaveBeenCalledTimes(2));
  act(() =>
    patch({
      result: {
        ...result,
        history: [...(result.history ?? []), variation("new")],
      },
    })
  );
  await act(async () => {
    second(result);
    await pendingB;
  });
  await act(async () => {
    first(result);
    await pendingA;
  });

  expect(deleteVersion).toHaveBeenNthCalledWith(
    1,
    "delete-race",
    "node",
    0,
    "a"
  );
  expect(deleteVersion).toHaveBeenNthCalledWith(
    2,
    "delete-race",
    "node",
    1,
    "b"
  );
  expect(latest[0]?.result?.history?.map((image) => image.url)).toEqual([
    "c",
    "new",
  ]);
  expect(latest[0]?.config?.selectedVersion).toBe(0);

  const detach = runStore.attach("delete-race", (_id, fields) => patch(fields));
  act(() =>
    runStore.patch("delete-race", "node", {
      result: {
        ...result,
        history: [...(result.history ?? []), variation("new")],
      },
      runState: "succeeded",
    })
  );
  expect(latest[0]?.result?.history?.map((image) => image.url)).toEqual([
    "c",
    "new",
  ]);
  detach();
});

it("waits for the pending tool save before deleting its newly shown image", async () => {
  let saved: (value: null) => void = () => undefined;
  const saving = keepResultWrite(
    "delete-pending",
    "node",
    new Promise<null>((resolve) => {
      saved = resolve;
    })
  );
  deleteVersion.mockResolvedValue(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness boardId="delete-pending" />));
  const deleting = remove("node", 2);
  expect(deleteVersion).not.toHaveBeenCalled();
  await act(async () => {
    saved(null);
    await saving;
    await deleting;
  });
  expect(deleteVersion).toHaveBeenCalledExactlyOnceWith(
    "delete-pending",
    "node",
    2,
    "c"
  );
  expect(latest[0]?.result?.history?.map((image) => image.url)).toEqual([
    "a",
    "b",
  ]);
});
