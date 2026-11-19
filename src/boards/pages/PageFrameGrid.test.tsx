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
import { workspaceGrid } from "../../../config/pageWorkspaceGrid.js";
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
  const navbar = createConceptElement("navbar");
  const design = cleanPageDesign({
    boxes: {
      [left.id]: { height: 100, width: 180, x: 0, y: 0 },
      [right.id]: { height: 100, width: 200, x: 700, y: 0 },
    },
    concept: { ...createConcept(), elements: [right, next, row, navbar, left] },
    height: 600,
    version: 1,
    width: 900,
  });
  if (!design) {
    throw new Error("Missing frame");
  }
  const page = cleanPageDesign({
    ...design,
    grid: workspaceGrid(design, design.concept.elements),
  });
  if (!page?.grid) {
    throw new Error("Missing grid design");
  }
  const host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() => root.render(<PageDesignView page={page} />));
    const [rightSide, main, band, nav, leftSide] = host.querySelectorAll(
      ".page-design__component"
    );
    const headerWidths = () =>
      [nav, band].map((el) => el.getBoundingClientRect().width);
    expect(headerWidths()).toEqual([900, 900]);
    expect(nav.getBoundingClientRect().bottom).toBe(
      band.getBoundingClientRect().top
    );
    for (const el of [leftSide, main, rightSide]) {
      expect(el.getBoundingClientRect().top).toBe(
        band.getBoundingClientRect().bottom
      );
    }
    const width = () => main.getBoundingClientRect().width;
    const [rightButton, leftButton] = host.querySelectorAll<HTMLButtonElement>(
      ".concept-panel__trigger"
    );
    const initial = width();
    expect(initial).toBe(520);
    await act(() => leftButton.click());
    await expect.poll(width).toBeGreaterThan(initial + 50);
    const oneClosed = width();
    await act(() => rightButton.click());
    await expect.poll(width).toBeGreaterThan(oneClosed + 50);
    expect(headerWidths()).toEqual([900, 900]);
    await act(() => leftButton.click());
    await act(() => rightButton.click());
    await expect.poll(width).toBe(initial);
    const summary = host.querySelector("summary");
    if (!summary) {
      throw new Error("Missing disclosure");
    }
    const { top } = main.getBoundingClientRect();
    await act(() => summary.click());
    expect(main.getBoundingClientRect().top).toBeLessThan(top);
    await act(() => summary.click());
    expect(main.getBoundingClientRect().top).toBe(top);
    const exported = componentSource(row, "Study cards");
    expect(exported.tsx).toContain("<details open");
    expect(exported.tsx).toContain("<summary>Study cards</summary>");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
