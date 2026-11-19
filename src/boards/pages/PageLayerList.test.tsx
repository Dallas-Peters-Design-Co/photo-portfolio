import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import "./PageCanvasEditor.css";
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
