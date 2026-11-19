import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults";
import { cleanPageDesign, type PageDesign } from "../../../config/pageDesign";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import { PageDesignView } from "./PageDesignView";
import { resizePageFrame } from "./resizePageFrame";

it("wraps web content and moves the next row while keeping the same on-board type size", async () => {
  const card = {
    ...createConceptElement("card"),
    text:
      "Long card\n" +
      "A sentence of detail that should wrap across several lines. ".repeat(8),
  };
  const button = createConceptElement("button");
  const design: PageDesign = {
    boxes: {
      [card.id]: { height: 24, width: 768, x: 16, y: 0 },
      [button.id]: { height: 40, width: 120, x: 16, y: 36 },
    },
    concept: { ...createConcept(), elements: [card, button] },
    height: 600,
    kitId: null,
    version: 1,
    width: 800,
  };
  const frame = {
    ...BLANK_ITEM,
    config: { pageDesign: design },
    height: 300,
    id: "frame",
    kind: "frame" as const,
    width: 400,
    x: 0,
    y: 0,
    z: 0,
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  async function measure(width: number) {
    const page = cleanPageDesign(
      resizePageFrame(frame, { height: 300, width })
    );
    if (!page) {
      throw new Error("Missing resized page");
    }
    host.style.width = `${width}px`;
    await act(() => root.render(<PageDesignView page={page} stepIndex={0} />));
    const sheet = host.querySelector(".page-design__sheet");
    const [first, second] = host.querySelectorAll(".page-design__component");
    await vi.waitFor(() =>
      expect(sheet?.getBoundingClientRect().width).toBe(width)
    );
    return {
      height: first.getBoundingClientRect().height,
      scale: sheet && getComputedStyle(sheet).transform,
      top: second.getBoundingClientRect().top,
    };
  }
  try {
    const wide = await measure(400);
    const narrow = await measure(200);
    expect(narrow.scale).toBe(wide.scale);
    expect(narrow.height).toBeGreaterThan(wide.height);
    expect(narrow.top).toBeGreaterThan(wide.top);
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
