import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { componentSource } from "../../../config/componentSource.js";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import { cleanPageDesign } from "../../../config/pageDesign.js";
import { DEFAULT_FRAME_GRID } from "../../../config/pageFrameGrid.js";
import { PageDesignView } from "./PageDesignView";

it("reclaims each sidebar track independently and keeps the card row interactive after reload", async () => {
  const panel = (text: string) => ({
    ...createConceptElement("panel"),
    slots: {
      hide: { elements: [{ ...createConceptElement("button"), text: "" }] },
    },
    text,
  });
  const left = panel("Extracted content");
  const right = panel("Summary");
  const row = {
    ...createConceptElement("group"),
    group: {
      disclosureLabel: "Study cards",
      elements: [createConceptElement("card"), createConceptElement("card")],
      layout: "row" as const,
    },
  };
  const next = createConceptElement("text");
  const page = cleanPageDesign({
    boxes: {
      [left.id]: { height: 100, width: 180, x: 0, y: 0 },
      [right.id]: { height: 100, width: 200, x: 700, y: 0 },
    },
    concept: { ...createConcept(), elements: [left, row, right, next] },
    grid: {
      ...DEFAULT_FRAME_GRID,
      cells: { [next.id]: { column: 1, columnSpan: 3, row: 2, rowSpan: 1 } },
    },
    height: 600,
    version: 1,
    width: 900,
  });
  if (!page) {
    throw new Error("Missing grid design");
  }
  const host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() => root.render(<PageDesignView page={page} />));
    const [, main, , below] = host.querySelectorAll(".page-design__component");
    const width = () => main.getBoundingClientRect().width;
    const [leftButton, rightButton] = host.querySelectorAll<HTMLButtonElement>(
      ".concept-panel__trigger"
    );
    const initial = width();
    expect(initial).toBe(520);
    await act(() => leftButton.click());
    await expect.poll(width).toBeGreaterThan(initial + 50);
    const oneClosed = width();
    await act(() => rightButton.click());
    await expect.poll(width).toBeGreaterThan(oneClosed + 50);
    await act(() => leftButton.click());
    await act(() => rightButton.click());
    await expect.poll(width).toBe(initial);
    const summary = host.querySelector("summary");
    if (!summary) {
      throw new Error("Missing disclosure");
    }
    const { top } = below.getBoundingClientRect();
    await act(() => summary.click());
    expect(below.getBoundingClientRect().top).toBeLessThan(top);
    await act(() => summary.click());
    expect(below.getBoundingClientRect().top).toBe(top);
    const exported = componentSource(row, "Study cards");
    expect(exported.tsx).toContain("<details open");
    expect(exported.tsx).toContain("<summary>Study cards</summary>");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
