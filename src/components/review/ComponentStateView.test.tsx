import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { componentSource } from "../../../config/componentSource.js";
import { createStatefulComponent } from "../../../config/componentStates.js";
import { newComponentStyleLook } from "../../../config/componentStyleTransfer.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import { cleanConceptStyles, fromStyle } from "../../../config/conceptStyle.js";
import { cleanElement } from "../../../config/reviewConcept.js";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

it("saves named states in the kit and switches only the chosen instance", async () => {
  const original = createStatefulComponent();
  original.group = {
    elements: ["Default", "Active"].map((name) => ({
      ...createConceptElement("text"),
      stateName: name,
      text: name,
    })),
    stateful: true,
  };
  const [style] = cleanConceptStyles([
    {
      id: "stateful",
      kind: "group",
      look: newComponentStyleLook(original),
      name: "Workflow",
    },
  ]);
  const insert = () =>
    cleanElement(fromStyle(createConceptElement("group"), style));
  const a = insert(),
    b = insert();
  expect(a.group?.elements[0].id).not.toBe(b.group?.elements[0].id);
  expect(componentSource(a, "Workflow").tsx).toContain("setActive(index)");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() =>
      root.render(
        <>
          <ReviewConceptElementView element={a} />
          <ReviewConceptElementView element={b} />
        </>
      )
    );
    const [first, second] = host.querySelectorAll(".concept-states");
    const buttons = first.querySelectorAll("button");
    expect(buttons[1].textContent).toBe("Active");
    await act(() => buttons[1].click());
    expect(first.querySelector(".concept-group__items")?.textContent).toBe(
      "Active"
    );
    expect(second.querySelector(".concept-group__items")?.textContent).toBe(
      "Default"
    );
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});

it("opens every card in an existing unnamed stateful row and collapses them together", async () => {
  const row = createStatefulComponent();
  expect(row.group?.elements).toHaveLength(0);
  row.group = {
    elements: ["Ingestion", "Findings", "Screening"].map((text) => ({
      ...createConceptElement("card"),
      text,
    })),
    layout: "row",
    stateful: true,
  };
  const source = componentSource(row, "Study cards").tsx;
  expect(source).toContain("<details");
  expect(source).toContain("Screening");
  const rootNode = document.createElement("div");
  document.body.append(rootNode);
  const root = createRoot(rootNode);
  try {
    await act(() => root.render(<ReviewConceptElementView element={row} />));
    const details = rootNode.querySelector("details");
    expect(details?.open).toBe(true);
    const cards = rootNode.querySelectorAll(".concept-group__items > *");
    expect(Array.from(cards, (card) => card.textContent)).toEqual([
      "Ingestion",
      "Findings",
      "Screening",
    ]);
    expect(rootNode.textContent).not.toContain("State 1");
    await act(() => details?.querySelector("summary")?.click());
    expect(details?.open).toBe(false);
    await act(() => details?.querySelector("summary")?.click());
    expect(details?.open).toBe(true);
  } finally {
    await act(() => root.unmount());
    rootNode.remove();
  }
});
