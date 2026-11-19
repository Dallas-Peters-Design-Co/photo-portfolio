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
