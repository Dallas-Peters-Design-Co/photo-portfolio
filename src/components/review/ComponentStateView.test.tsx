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

async function choose(select: HTMLSelectElement, value: string) {
  await act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

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
  expect(componentSource(a, "Workflow").tsx).toContain(
    'aria-label="Component state"'
  );
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
    const select = first.querySelector("select");
    if (!select) {
      throw new Error("Missing state selector");
    }
    expect(select.options[1].text).toBe("Active");
    await choose(select, "1");
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
    disclosureLabel: "Cards",
    elements: ["Ingestion", "Findings", "Screening"].map((text) => ({
      ...createConceptElement("card"),
      text,
    })),
    layout: "row",
    stateful: true,
  };
  const source = componentSource(row, "Study cards").tsx;
  expect(source).toContain("<select");
  expect(source).toContain("Screening");
  const rootNode = document.createElement("div");
  document.body.append(rootNode);
  const root = createRoot(rootNode);
  try {
    await act(() => root.render(<ReviewConceptElementView element={row} />));
    expect(rootNode.querySelector("summary")).toBeNull();
    const selector = rootNode.querySelector("select");
    if (!selector) {
      throw new Error("Missing state selector");
    }
    const cards = rootNode.querySelectorAll(".concept-group__items > *");
    expect(Array.from(cards, (card) => card.textContent)).toEqual([
      "Ingestion",
      "Findings",
      "Screening",
    ]);
    expect(rootNode.textContent).not.toContain("State 1");
    await choose(selector, "1");
    expect(rootNode.querySelector(".concept-group__items")).toBeNull();
    await choose(selector, "0");
    expect(rootNode.querySelectorAll(".concept-group__items > *")).toHaveLength(
      3
    );
    const saved = cleanElement({
      ...row,
      group: { ...row.group, initialState: 1 },
    });
    await act(() => root.render(<ReviewConceptElementView element={saved} />));
    expect(rootNode.querySelector("select")?.value).toBe("1");
    expect(componentSource(saved, "Study cards").tsx).toContain("useState(1)");
  } finally {
    await act(() => root.unmount());
    rootNode.remove();
  }
});
