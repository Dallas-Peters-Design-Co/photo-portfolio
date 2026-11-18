import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { componentSource } from "../../../config/componentSource.js";
import {
  cleanConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { ReviewConceptPreview } from "./ReviewConceptPreview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const panel = {
  id: "drawer",
  kind: "panel",
  slideFrom: "right",
  slots: {
    body: { elements: [{ kind: "text", text: "Filters" }] },
    hide: { elements: [{ id: "close", kind: "button", text: "Close" }] },
  },
  text: "Filter results",
};

it("slides a panel in, and its hide slot slides it out and moves the sequence on", async () => {
  const concept = cleanConcept({
    elements: [panel],
    steps: [
      {
        caption: "Back to the list",
        elements: [{ kind: "text", text: "Panel closed" }],
      },
    ],
    stepTrigger: "drawer",
  });
  expect(concept.elements[0]?.slideFrom).toBe("right");
  const host = document.createElement("div");
  host.style.width = "480px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(<ReviewConceptPreview concept={concept} />)
  );

  const drawn = host.querySelector(".concept-panel") as HTMLElement;
  expect(drawn.dataset.slide).toBe("right");
  expect(getComputedStyle(drawn).animationName).toContain("concept-slide-in");

  // A click on the panel's body is not the hide button: nothing moves on.
  await userEvent.click(
    host.querySelector(".concept-panel .concept-slot__lead") as HTMLElement
  );
  expect(host.textContent).toContain("Step 1 of 2");

  await userEvent.click(
    host.querySelector(".concept-panel__hide button") as HTMLElement
  );
  await vi.waitFor(() => expect(host.textContent).toContain("Panel closed"), {
    timeout: 2000,
  });
  expect(host.textContent).toContain("Step 2 of 2");
});

it("puts the hide slot in a panel's copied code", () => {
  const element = cleanConcept({ elements: [panel] })
    .elements[0] as ReviewConceptElement;
  const source = componentSource(element, "Drawer");
  expect(source.tsx).toContain('className="panel-drawer__hide"');
  expect(source.css).toContain(".panel-drawer__hide {");
  expect(source.tsx).toContain('d="m15 5-7 7 7 7"');
  expect(source.css).toContain('.panel-drawer__trigger[aria-expanded="false"]');
});

it("reopens a saved collapsed panel with the same external keyboard control", async () => {
  const concept = cleanConcept({
    elements: [{ ...panel, panelCollapsed: true }],
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<ReviewConceptPreview concept={concept} />));
    const trigger = host.querySelector(
      ".concept-panel__trigger"
    ) as HTMLButtonElement;
    const chevron = host.querySelector(
      ".concept-panel__hide svg"
    ) as SVGElement;
    expect(getComputedStyle(chevron).rotate).toBe("180deg");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector(".concept-panel__inner")).toBeNull();
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getComputedStyle(chevron).rotate).toBe("none");
    expect(
      host.querySelector(".concept-panel__surface")?.textContent
    ).toContain("Filters");
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() =>
      expect(host.querySelector(".concept-panel__inner")).toBeNull()
    );
    expect(document.activeElement).toBe(trigger);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
