import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
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

// A desktop-sized window: the editor's three columns don't fit the default
// phone-sized one, which leaves the artboard column no width at all.
beforeAll(async () => {
  await page.viewport(1440, 900);
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
  // Shapes are icon buttons, found by their title.
  const found = [...document.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").includes(text) || b.title.startsWith(text)
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

  const captureDownload = () => {
    const got: { blob: Blob | null; name: string } = { blob: null, name: "" };
    const create = vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
      got.blob = b as Blob;
      return "blob:test";
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        got.name = this.download;
      });
    return {
      done: () => {
        create.mockRestore();
        click.mockRestore();
      },
      got,
    };
  };

  const exportVia = async (action: string) => {
    const capture = captureDownload();
    act(() => button("Export").click());
    await act(async () => {
      button(action).click();
      await vi.waitFor(() => expect(capture.got.blob).not.toBeNull(), {
        timeout: 5000,
      });
    });
    capture.done();
    return capture.got as { blob: Blob; name: string };
  };

  it("exports every slide on the board as one PDF from a deck frame", async () => {
    const slide = {
      ...frame,
      body: "Deck · Slide · 16:9 · 1920×1080",
      height: 270,
      width: 480,
    };
    render([slide, { ...slide, id: "f2", x: 600 }]);
    act(() => button("Headline").click());
    const { blob, name } = await exportVia("Export PDF");
    const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    expect(name.endsWith(".pdf")).toBe(true);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/Width 1920 /Height 1080");
  });

  it("exports an email frame as a zip of mail HTML and its picture", async () => {
    render([
      {
        ...frame,
        body: "Email · Full email · 600×1200",
        height: 600,
        width: 300,
      },
    ]);
    act(() => button("Headline").click());
    const { blob } = await exportVia("Export zip");
    const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    expect(text).toContain("images/email.png");
    expect(text).toContain('alt="Your headline here"');
    expect(text).toContain('role="presentation"');
  });

  it("exports a landing hero as a page that fits the window, with no clickTag", async () => {
    render([
      {
        ...frame,
        body: "Landing · Hero · desktop · 1440×900",
        height: 450,
        width: 720,
      },
    ]);
    act(() => button("Headline").click());
    const { blob } = await exportVia("Export zip");
    const text = new TextDecoder().decode(await blob.arrayBuffer());
    expect(text).toContain('name="viewport"');
    expect(text).not.toContain("clickTag");
    expect(text).toContain("/1440");
  });

  describe("a selected layer under another", () => {
    const rect = (id: string, x: number, z: number): BoardItem => ({
      ...base,
      config: {
        fill: "#f55c3e",
        opacity: 1,
        radius: 0,
        stroke: "#00000000",
        strokeWidth: 0,
        tool: "rect",
      },
      height: 200,
      id,
      kind: "drawing",
      width: 200,
      x,
      y: 100,
      z,
    });
    const at = (el: Element, fx: number, fy: number) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * fx, y: r.top + r.height * fy };
    };
    const pointer = (
      type: string,
      target: Element,
      p: { x: number; y: number }
    ) =>
      act(() => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            clientX: p.x,
            clientY: p.y,
            pointerId: 1,
          })
        );
      });
    const selectFromList = (name: string, index: number) => {
      const rows = [...document.querySelectorAll(".creative__layer-row")];
      expect(rows[index]?.textContent).toBe(name);
      act(() => (rows[index] as HTMLButtonElement).click());
    };

    it("turns the selected layer with the rotate grip, in 15° steps with Shift", () => {
      render([frame, rect("low", 100, 1)]);
      selectFromList("Rectangle", 0);
      const grip = document.querySelector(".creative__rotate") as Element;
      const board = document.querySelector(".creative__board") as Element;
      const box = document.querySelector(".creative__selection") as Element;
      const centre = at(box, 0.5, 0.5);
      const start = at(grip, 0.5, 0.5);
      pointer("pointerdown", grip, start);
      // A quarter turn clockwise: from above the centre to its right.
      const right = { x: centre.x + (centre.y - start.y), y: centre.y };
      act(() => {
        board.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: right.x,
            clientY: right.y + 2,
            pointerId: 1,
            shiftKey: true,
          })
        );
      });
      pointer("pointerup", board, right);
      const low = latest.find((i) => i.id === "low");
      expect(low?.rotation).toBe(90);
      expect(low?.x).toBe(100);
      const layer = document.querySelector(
        '[data-layer-id="low"]'
      ) as HTMLElement;
      expect(layer.style.transform).toBe("rotate(90deg)");
    });

    const shiftPick = (index: number) => {
      const rows = [...document.querySelectorAll(".creative__layer-row")];
      act(() =>
        rows[index]?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, shiftKey: true })
        )
      );
    };

    it("selects several layers, moves them together, and aligns them", () => {
      render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
      selectFromList("Rectangle", 0);
      shiftPick(1);
      expect(document.querySelector(".creative__count")?.textContent).toBe(
        "2 layers"
      );
      expect(
        document.querySelectorAll(".creative__layer--selected")
      ).toHaveLength(2);

      // Drag one of them: both move by the same amount.
      const layer = document.querySelector('[data-layer-id="a"]') as Element;
      const board = document.querySelector(".creative__board") as Element;
      const from = at(layer, 0.5, 0.5);
      // The test stage is small, so the artboard is drawn tiny: a pixel on
      // screen is many canvas units. ⌘ turns snapping off.
      const scale = board.getBoundingClientRect().width / 540;
      const to = { x: from.x + 20 * scale, y: from.y + 30 * scale };
      pointer("pointerdown", layer, from);
      act(() => {
        board.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: to.x,
            clientY: to.y,
            metaKey: true,
            pointerId: 1,
          })
        );
      });
      pointer("pointerup", board, to);
      const a = latest.find((i) => i.id === "a");
      const b = latest.find((i) => i.id === "b");
      expect([a?.x, a?.y, b?.x, b?.y]).toEqual([60, 130, 320, 130]);

      act(() =>
        (
          document.querySelector(
            '[aria-label="Align left edges"]'
          ) as HTMLElement
        ).click()
      );
      expect(latest.find((i) => i.id === "b")?.x).toBe(
        latest.find((i) => i.id === "a")?.x
      );
    });

    it("selects with a marquee, and deletes the selection with one key", () => {
      render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
      const board = document.querySelector(".creative__board") as Element;
      const r = board.getBoundingClientRect();
      const scale = r.width / 540;
      // From empty artboard top-left, across both rectangles.
      const start = { x: r.left + 5 * scale, y: r.top + 5 * scale };
      pointer("pointerdown", board, start);
      pointer("pointermove", board, {
        x: r.left + 520 * scale,
        y: r.top + 150 * scale,
      });
      pointer("pointerup", board, {
        x: r.left + 520 * scale,
        y: r.top + 150 * scale,
      });
      expect(document.querySelector(".creative__count")?.textContent).toBe(
        "2 layers"
      );
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
      });
      expect(latest.map((i) => i.id)).toEqual(["f"]);
    });

    it("selects everything with ⌘A and copies it all with ⌘D", () => {
      render([frame, rect("a", 40, 1), rect("b", 300, 2)]);
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "a", metaKey: true })
        );
      });
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "d", metaKey: true })
        );
      });
      expect(latest).toHaveLength(5);
      expect(document.querySelector(".creative__count")?.textContent).toBe(
        "2 layers"
      );
    });

    it("resizes from a side even where the layer on top covers it", () => {
      // "low" spans 100–300; "top" sits over its right edge at 250–450.
      render([frame, rect("low", 100, 1), rect("top", 250, 2)]);
      selectFromList("Rectangle", 1);
      const edge = document.querySelector(".creative__edge--e") as Element;
      const board = document.querySelector(".creative__board") as Element;
      const start = at(edge, 0.5, 0.5);
      pointer("pointerdown", edge, start);
      pointer("pointermove", board, { x: start.x + 40, y: start.y });
      pointer("pointerup", board, { x: start.x + 40, y: start.y });
      const low = latest.find((i) => i.id === "low");
      expect(low?.width).toBeGreaterThan(200);
      expect(low?.x).toBe(100);
    });

    it("drags the selected layer from inside, and a plain click picks the one on top", () => {
      render([frame, rect("low", 100, 1), rect("top", 250, 2)]);
      selectFromList("Rectangle", 1);
      const box = document.querySelector(".creative__selection") as Element;
      const board = document.querySelector(".creative__board") as Element;
      // Inside "low", where "top" is drawn over it.
      const inside = at(box, 0.9, 0.5);
      pointer("pointerdown", box, inside);
      pointer("pointerup", board, inside);
      expect(
        document
          .querySelector(".creative__layer--selected")
          ?.getAttribute("data-layer-id")
      ).toBe("top");

      selectFromList("Rectangle", 1);
      const again = document.querySelector(".creative__selection") as Element;
      const from = at(again, 0.9, 0.5);
      pointer("pointerdown", again, from);
      pointer("pointermove", board, { x: from.x - 30, y: from.y });
      pointer("pointerup", board, { x: from.x - 30, y: from.y });
      expect(latest.find((i) => i.id === "low")?.x).toBeLessThan(100);
      expect(latest.find((i) => i.id === "top")?.x).toBe(250);
    });
  });
});
