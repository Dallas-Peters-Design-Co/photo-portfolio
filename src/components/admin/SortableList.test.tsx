import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { EditorBlock } from "./EditorBlock";
import { SortableList } from "./SortableList";

const ITEMS = [{ id: "a" }, { id: "b" }, { id: "c" }];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

const mount = async (onReorder: (ids: string[]) => void, markDrop = false) => {
  host = document.createElement("div");
  host.style.width = "400px";
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root?.render(
      <SortableList
        itemLabel={(i) => i.id}
        items={ITEMS}
        markDrop={markDrop}
        onReorder={onReorder}
      >
        {(item, { compact, handle }) => (
          <EditorBlock
            collapsed={compact}
            handle={handle}
            onToggle={() => undefined}
            title={item.id}
          >
            <div style={{ height: 300 }}>body {item.id}</div>
          </EditorBlock>
        )}
      </SortableList>
    )
  );
};

const handleOf = (id: string) =>
  document.querySelector<HTMLButtonElement>(
    `[data-sortable-id="${id}"] .sortable__handle`
  ) as HTMLButtonElement;

const pointer = (type: string, el: Element, y: number) =>
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: y,
      pointerId: 1,
    })
  );

it("folds every item while dragging, shows the gap, and drops into it", async () => {
  const orders: string[][] = [];
  await mount((ids) => orders.push(ids));
  const first = handleOf("a");
  const { top } = first.getBoundingClientRect();
  await act(() => pointer("pointerdown", first, top + 5));

  // Every body folds, and a highlighted gap holds the dragged item's place.
  const bodies = [...document.querySelectorAll(".editor-block__body")];
  expect(bodies.every((b) => (b as HTMLElement).hidden)).toBe(true);
  const gap = document.querySelector<HTMLElement>(".sortable__gap");
  expect(gap).not.toBeNull();
  expect(gap?.offsetHeight).toBeGreaterThan(0);

  // Carried below the last item, the gap moves to the end.
  const last = document
    .querySelector('[data-sortable-id="c"]')
    ?.getBoundingClientRect();
  await act(() => pointer("pointermove", first, (last?.bottom ?? 0) + 5));
  expect(gap?.style.order).toBe("2");

  await act(() => pointer("pointerup", first, (last?.bottom ?? 0) + 5));
  await act(() =>
    first.dispatchEvent(
      new PointerEvent("lostpointercapture", { bubbles: true })
    )
  );
  expect(orders).toEqual([["b", "c", "a"]]);
  expect(document.querySelector(".sortable__gap")).toBeNull();
});

it("moves an item with the arrow keys on its handle", async () => {
  const orders: string[][] = [];
  await mount((ids) => orders.push(ids));
  await act(() =>
    handleOf("b").dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" })
    )
  );
  expect(orders).toEqual([["b", "a", "c"]]);
});

it("marks a drop between expanded variants without moving the scrolled page", async () => {
  const orders: string[][] = [];
  await mount((ids) => orders.push(ids), true);
  if (!host) {
    throw new Error("Missing list");
  }
  host.style.paddingBlock = "1200px";
  const first = handleOf("a");
  const second = handleOf("b");
  const center = second.closest(".sortable__item")?.getBoundingClientRect();
  if (!center) {
    throw new Error("Missing target variant");
  }
  window.scrollBy(0, center.top + center.height / 2 - window.innerHeight / 2);
  const scroll = window.scrollY;
  expect(scroll).toBeGreaterThan(0);
  const height = host.offsetHeight;
  const y = window.innerHeight / 2 + 8;
  await act(() =>
    pointer("pointerdown", first, first.getBoundingClientRect().top)
  );
  await act(() => pointer("pointermove", first, y));
  expect(
    host.querySelector('[data-sortable-id="b"]')?.getAttribute("data-drop-edge")
  ).toBe("after");
  expect(host.offsetHeight).toBe(height);
  expect(window.scrollY).toBe(scroll);
  await act(() => pointer("pointerup", first, y));
  await new Promise<void>((done) => requestAnimationFrame(() => done()));
  expect(orders).toEqual([["b", "a", "c"]]);
  expect(window.scrollY).toBe(scroll);
});
