import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { createConceptElement } from "../admin/ReviewConceptBrand";
import { ReviewConceptElementFields } from "../admin/ReviewConceptElementFields";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  host = document.createElement("div");
  host.style.width = "480px";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("draws a new panel's title and samples in their slots", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{ ...createConceptElement("panel"), text: "Agents" }}
      />
    )
  );
  const slots = [...host.querySelectorAll<HTMLElement>(".concept-slot")];
  expect(slots.map((slot) => slot.dataset.slot)).toEqual([
    "header",
    "body",
    "footer",
  ]);
  const [header, body, footer] = slots;
  expect(header?.textContent).toBe("Agents3");
  // The title and the count share one line, centred on each other.
  const [title, count] = [...(header?.children ?? [])] as HTMLElement[];
  const middle = (el?: HTMLElement) => {
    const box = el?.getBoundingClientRect();
    return box ? box.top + box.height / 2 : 0;
  };
  expect(Math.abs(middle(title) - middle(count))).toBeLessThan(2);
  expect(body?.querySelector('[role="progressbar"]')).not.toBeNull();
  expect(footer?.textContent).toContain("+ New item");
  // Lines run between the slots.
  expect(getComputedStyle(body as HTMLElement).borderTopWidth).toBe("1px");
});

it("lays a grid slot out in its columns", () => {
  const button = createConceptElement("button");
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    slots: {
      body: {
        columns: 2,
        elements: [0, 1, 2, 3].map((n) => ({ ...button, id: `b${n}` })),
        layout: "grid",
      },
    },
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  const buttons = [...host.querySelectorAll("button")];
  const tops = buttons.map((b) => Math.round(b.getBoundingClientRect().top));
  expect(tops[0]).toBe(tops[1]);
  expect(tops[2]).toBeGreaterThan(tops[0] ?? 0);
});

function Harness() {
  const [panel, setPanel] = useState(() => createConceptElement("panel"));
  return (
    <>
      <ReviewConceptElementFields
        element={panel}
        onChange={(patch) => setPanel({ ...panel, ...patch })}
      />
      <output data-testid="gap">{panel.slots?.body?.gap}</output>
    </>
  );
}

it("edits each slot's layout and lists what it holds", () => {
  act(() => root.render(<Harness />));
  for (const slot of ["Header slot", "Body slot", "Footer slot"]) {
    expect(host.textContent).toContain(slot);
  }
  // The body's samples are editable in place, as elements of their own.
  const kinds = [
    ...host.querySelectorAll<HTMLElement>(".review-concepts__element"),
  ].map((section) => section.getAttribute("aria-label"));
  expect(kinds).toEqual(
    expect.arrayContaining(["panel", "badge", "progress", "checkbox", "button"])
  );
  const gaps = [
    ...host.querySelectorAll<HTMLInputElement>('input[aria-label="Gap"]'),
  ];
  // Header, body, footer: the body's is the second.
  const [, bodyGap] = gaps;
  if (!bodyGap) {
    throw new Error("A gap field per slot");
  }
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  act(() => {
    setValue?.call(bodyGap, "20");
    bodyGap.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.querySelector('[data-testid="gap"]')?.textContent).toBe("20");
});
