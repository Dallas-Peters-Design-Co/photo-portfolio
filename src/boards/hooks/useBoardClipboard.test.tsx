import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { BoardItem, BoardWire } from "../../types";
import { CLIP_TYPE } from "../io/itemClipboard";
import { useBoardClipboard } from "./useBoardClipboard";

/**
 * Cut, copy and paste on the board, through real clipboard events: what a
 * copy puts on the clipboard, that a paste of it lands fresh copies (here or
 * in another tab), and that a field keeps its own clipboard.
 */

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

afterEach(() => {
  root?.unmount();
  host?.remove();
  host = null;
  root = null;
});

const item = (id: string, x: number) =>
  ({ height: 100, id, kind: "note", width: 100, x, y: 0, z: 1 }) as BoardItem;

interface Board {
  items: BoardItem[];
  selection: ReadonlySet<string>;
  wires: BoardWire[];
}

const mount = async (start: Board) => {
  const board = { ...start };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  function Probe() {
    useBoardClipboard({
      enabled: true,
      items: board.items,
      onChange: (next) => {
        board.items = next;
      },
      onWiresChange: (next) => {
        board.wires = next;
      },
      removeIds: (ids) => {
        board.items = board.items.filter((i) => !ids.has(i.id));
      },
      selection: board.selection,
      setSelection: (next) => {
        board.selection = next;
      },
      viewCentre: () => ({ x: 0, y: 0 }),
      wires: board.wires,
    });
    return <input defaultValue="a prompt" />;
  }
  const render = async () => {
    root?.render(<Probe />);
    await flush();
    await flush();
  };
  await render();
  return { board, render };
};

const fire = (type: "copy" | "cut" | "paste", data = new DataTransfer()) => {
  window.dispatchEvent(
    new ClipboardEvent(type, { cancelable: true, clipboardData: data })
  );
  return data;
};

describe("useBoardClipboard", () => {
  it("copies the selection and pastes a fresh copy, selected", async () => {
    const { board, render } = await mount({
      items: [item("a", 0), item("b", 500)],
      selection: new Set(["a"]),
      wires: [],
    });
    const data = fire("copy");
    expect(data.getData("text/plain")).toBe("1 item copied from a board");
    expect(JSON.parse(data.getData(CLIP_TYPE)).items[0].id).toBe("a");
    fire("paste", data);
    expect(board.items).toHaveLength(3);
    const pasted = board.items.at(-1);
    expect(pasted?.id).not.toBe("a");
    expect(pasted?.x).toBe(40);
    expect([...board.selection]).toEqual([pasted?.id]);
    await render();
  });

  it("cuts: the items leave, and a paste brings them back", async () => {
    const { board, render } = await mount({
      items: [item("a", 0), item("b", 500)],
      selection: new Set(["a", "b"]),
      wires: [],
    });
    const data = fire("cut");
    expect(board.items).toHaveLength(0);
    await render();
    fire("paste", data);
    expect(board.items).toHaveLength(2);
  });

  it("pastes what another tab copied", async () => {
    const { board } = await mount({
      items: [],
      selection: new Set(),
      wires: [],
    });
    const data = new DataTransfer();
    data.setData(
      CLIP_TYPE,
      JSON.stringify({
        from: null,
        items: [item("far", 0)],
        label: "",
        wires: [],
      })
    );
    fire("paste", data);
    expect(board.items).toHaveLength(1);
    expect(board.items[0]?.id).not.toBe("far");
  });

  it("leaves a field's copy and paste to the field", async () => {
    const { board } = await mount({
      items: [item("a", 0)],
      selection: new Set(["a"]),
      wires: [],
    });
    host?.querySelector("input")?.focus();
    const data = fire("copy");
    expect(data.getData(CLIP_TYPE)).toBe("");
    fire("paste", data);
    expect(board.items).toHaveLength(1);
  });
});
