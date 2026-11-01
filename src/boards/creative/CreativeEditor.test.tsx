import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import { CreativeEditor } from "./CreativeEditor";

/**
 * The creative editor end to end in a real browser: adding layers, selecting
 * them from the list, and the keys that act on the selection without leaking
 * to the board behind.
 */

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const base = {
  body: null,
  config: null,
  creditName: null,
  creditUrl: null,
  fontSize: null,
  imageUrl: null,
  nodeType: null,
  photoId: null,
  result: null,
  runError: null,
  runState: null,
  textStyle: null,
  thumbUrl: null,
};

const frame: BoardItem = {
  ...base,
  body: "Instagram · Post · square · 1080×1080",
  height: 540,
  id: "f",
  kind: "frame",
  width: 540,
  x: 0,
  y: 0,
  z: 0,
};

let latest: BoardItem[] = [];

function Harness({ start }: { start: BoardItem[] }) {
  const [items, setItems] = useState(start);
  latest = items;
  return (
    <CreativeEditor
      frameId="f"
      items={items}
      onChange={setItems}
      onClose={() => undefined}
    />
  );
}

const render = (start: BoardItem[]) => {
  host = document.createElement("div");
  host.style.width = "1200px";
  host.style.height = "800px";
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness start={start} />));
};

const button = (text: string) => {
  const found = [...document.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text)
  );
  if (!found) {
    throw new Error(`no button ${text}`);
  }
  return found;
};

const key = (k: string, extra: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k, ...extra }));
  });

describe("CreativeEditor", () => {
  it("adds a headline and a shape onto the frame as board items", () => {
    render([frame]);
    act(() => button("Headline").click());
    act(() => button("Rounded").click());
    const kinds = latest.filter((i) => i.id !== "f").map((i) => i.kind);
    expect(kinds).toEqual(["text", "drawing"]);
    expect(document.querySelectorAll(".creative__layer")).toHaveLength(2);
  });

  it("nudges, duplicates and deletes the selected layer from the keyboard", () => {
    render([frame]);
    act(() => button("Rectangle").click());
    const shape = latest.find((i) => i.kind === "drawing");
    key("ArrowRight", { shiftKey: true });
    expect(latest.find((i) => i.id === shape?.id)?.x).toBe(
      (shape?.x ?? 0) + 10
    );
    key("d", { metaKey: true });
    expect(latest.filter((i) => i.kind === "drawing")).toHaveLength(2);
    key("Delete");
    expect(latest.filter((i) => i.kind === "drawing")).toHaveLength(1);
  });

  it("lists layers front first and selects from the list", () => {
    render([frame]);
    act(() => button("Ellipse").click());
    act(() => button("Body text").click());
    const rows = [...document.querySelectorAll(".creative__layer-row")];
    expect(rows.map((r) => r.textContent)).toEqual([
      "Supporting line of copy",
      "Ellipse",
    ]);
    act(() => (rows[1] as HTMLButtonElement).click());
    expect(
      document.querySelector(".creative__layer--selected svg")
    ).not.toBeNull();
  });

  it("exports an HTML5 ad zip with the layers, the size and the clickTag", async () => {
    let zipped: Blob | null = null;
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob) => {
        zipped = blob as Blob;
        return "blob:test";
      });
    render([frame]);
    act(() => button("Headline").click());
    act(() => button("Rectangle").click());
    act(() => button("Export").click());
    const field = document.querySelector<HTMLInputElement>(
      ".creative-export input"
    );
    act(() => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      set?.call(field, "https://example.com/spring");
      field?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      button("Export zip").click();
      await vi.waitFor(() => expect(zipped).not.toBeNull());
    });
    create.mockRestore();
    const bytes = new Uint8Array(
      await (zipped as unknown as Blob).arrayBuffer()
    );
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04_03_4b_50);
    const nameLength = view.getUint16(26, true);
    const size = view.getUint32(18, true);
    const name = new TextDecoder().decode(bytes.slice(30, 30 + nameLength));
    const html = new TextDecoder().decode(
      bytes.slice(30 + nameLength, 30 + nameLength + size)
    );
    expect(name).toBe("index.html");
    expect(html).toContain('content="width=1080,height=1080"');
    expect(html).toContain('var clickTag = "https://example.com/spring"');
    expect(html).toContain("Your headline here");
    expect(html.match(/<div style="height:/g)?.length).toBe(2);
  });
});
