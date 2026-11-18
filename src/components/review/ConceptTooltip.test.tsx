import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { componentSource } from "../../../config/componentSource.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import { styleElement } from "../../../config/conceptStyle.js";
import { cleanTooltip } from "../../../config/conceptTooltip.js";
import { jsxToHtml } from "../../../config/jsxToHtml.js";
import { cleanConcept } from "../../../config/reviewConcept.js";
import { ReviewConceptElementFields } from "../admin/ReviewConceptElementFields";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("opens an interactive tooltip on hover and keyboard focus", async () => {
  const element = {
    ...createConceptElement("button"),
    tooltip: cleanTooltip({ interactive: true, text: "More detail" }),
  };
  await act(() => root.render(<ReviewConceptElementView element={element} />));
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  const anchor = host.querySelector<HTMLElement>(
    ".concept-tooltip__trigger"
  ) as HTMLElement;
  await userEvent.hover(anchor);
  await vi.waitFor(() =>
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      "More detail"
    )
  );
  await userEvent.unhover(anchor);
  await vi.waitFor(() =>
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  );
  await act(() => anchor.focus());
  await vi.waitFor(() =>
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      "More detail"
    )
  );
  await userEvent.keyboard("{Escape}");
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  await act(() => anchor.querySelector<HTMLButtonElement>("button")?.focus());
  await vi.waitFor(() =>
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      "More detail"
    )
  );
});

it("shows a static tooltip and keeps the attachment when a review is reopened", async () => {
  const element = {
    ...createConceptElement("text"),
    tooltip: cleanTooltip({ side: "bottom", text: "Static hint" }),
  };
  const [reopened] = cleanConcept({ elements: [element] }).elements;
  expect(reopened?.tooltip).toMatchObject({
    interactive: false,
    side: "bottom",
    text: "Static hint",
  });
  await act(() =>
    root.render(
      <ReviewConceptElementView element={reopened as typeof element} />
    )
  );
  await vi.waitFor(() =>
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      "Static hint"
    )
  );
});

it("lets an editor attach a tooltip and turn on interaction", async () => {
  let saved = createConceptElement("badge");
  function Editor() {
    const [element, setElement] = useState(saved);
    saved = element;
    return (
      <ReviewConceptElementFields
        element={element}
        onChange={(patch) => setElement({ ...element, ...patch })}
      />
    );
  }
  await act(() => root.render(<Editor />));
  const add = [...host.querySelectorAll("label")].find((label) =>
    label.textContent?.includes("Add tooltip")
  );
  await userEvent.click(add as HTMLElement);
  const input = host.querySelector<HTMLInputElement>(
    '[aria-label="Tooltip text"]'
  ) as HTMLInputElement;
  await userEvent.clear(input);
  await userEvent.type(input, "Helpful hint");
  const interactive = [...host.querySelectorAll("label")].find((label) =>
    label.textContent?.includes("Interactive on hover")
  );
  await userEvent.click(interactive as HTMLElement);
  expect(saved.tooltip).toMatchObject({
    interactive: true,
    text: "Helpful hint",
  });
});

it("follows the tooltip's kit style and includes the attachment in copied source", () => {
  const tooltip = cleanTooltip({
    interactive: true,
    styleId: "help",
    text: "More detail",
  });
  const button = { ...createConceptElement("button"), tooltip };
  const styled = styleElement(button, [
    {
      id: "help",
      kind: "tooltip",
      look: { background: "#123456", color: "#ffffff", radius: 12 },
      name: "Help",
    },
  ]);
  expect(styled.tooltip?.look).toMatchObject({
    background: "#123456",
    radius: 12,
  });
  expect(styled.tooltip).toMatchObject({
    interactive: true,
    styleId: "help",
    text: "More detail",
  });
  const source = componentSource(styled, "Primary");
  expect(source.tsx).toContain('role="tooltip"');
  expect(source.tsx).toContain("ButtonPrimaryBase");
  expect(source.css).toContain("#123456");
  expect(source.css).toContain(":focus-within");
  expect(jsxToHtml(source.preview)).toContain("More detail");
});
