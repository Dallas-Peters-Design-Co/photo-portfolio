import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import "./PageCanvasEditor.css";
import { movePageLayer } from "../../../config/pageLayerMove.js";
import { LayerDragProvider } from "./PageLayerDrag";
import { PageLayerList } from "./PageLayerList";

it("indents group children, slot headings and slot items at successive depths", async () => {
  const badge = createConceptElement("badge");
  const card = {
    ...createConceptElement("card"),
    slots: {
      body: {
        elements: [
          createConceptElement("label"),
          createConceptElement("button"),
        ],
      },
      header: { elements: [badge] },
    },
  };
  const group = {
    ...createConceptElement("group"),
    group: { elements: [card, createConceptElement("text")] },
  };
  const host = document.createElement("div");
  host.className = "page-builder__layers";
  host.style.width = "320px";
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() =>
      root.render(
        <PageLayerList
          elements={[group]}
          onChange={vi.fn()}
          onSelect={vi.fn()}
          selected={null}
        />
      )
    );
    const left = (node: Element) => node.getBoundingClientRect().left;
    const [parent, container, onlyChild, firstChild, secondChild, sibling] =
      host.querySelectorAll(".page-builder__layer");
    const [header, body] = host.querySelectorAll(".page-builder__slot-label");
    expect(left(container)).toBeGreaterThan(left(parent));
    expect(left(sibling)).toBe(left(container));
    const labelLeft = (node: Element) => {
      const text = document.createRange();
      text.selectNodeContents(node.lastChild as Text);
      return text.getBoundingClientRect().left;
    };
    expect(labelLeft(header)).toBeGreaterThan(left(container));
    expect(labelLeft(body)).toBe(labelLeft(header));
    expect(left(onlyChild)).toBeGreaterThan(labelLeft(header));
    expect(left(firstChild)).toBe(left(onlyChild));
    expect(left(secondChild)).toBe(left(firstChild));
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});

it("drops a single child into an empty nested group and preserves its identity", async () => {
  const child = createConceptElement("button");
  const group = (elements: (typeof child)[]) => ({
    ...createConceptElement("group"),
    group: { elements },
  });
  const source = group([child]);
  const target = group([]);
  const roots = [source, group([target])];
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const move = vi.fn();
  try {
    await act(() =>
      root.render(
        <LayerDragProvider move={move}>
          <PageLayerList
            elements={roots}
            onChange={vi.fn()}
            onSelect={vi.fn()}
            selected={child.id}
          />
        </LayerDragProvider>
      )
    );
    const handle = host.querySelector(
      `[data-sortable-id="${child.id}"] .sortable__handle`
    );
    const destination = host.querySelector(
      `[data-sortable-id="${target.id}"] .page-builder__layer-row`
    );
    if (!(handle && destination)) {
      throw new Error("Missing draggable layers");
    }
    const rect = destination.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      clientY: rect.top + rect.height / 2,
      dataTransfer: new DataTransfer(),
    };
    await act(() => {
      handle.dispatchEvent(new DragEvent("dragstart", init));
    });
    await act(() => {
      destination.dispatchEvent(new DragEvent("dragover", init));
    });
    expect(destination.getAttribute("data-drop")).toBe("inside");
    await act(() => {
      destination.dispatchEvent(new DragEvent("drop", init));
    });
    expect(move).toHaveBeenCalledWith(child.id, target.id, "inside");
    const next = movePageLayer(roots, child.id, target.id, "inside");
    expect(next[0].group?.elements).toHaveLength(0);
    expect(next[1].group?.elements[0].group?.elements[0]).toBe(child);
    expect(movePageLayer(next, next[1].id, target.id, "inside")).toBe(next);
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
