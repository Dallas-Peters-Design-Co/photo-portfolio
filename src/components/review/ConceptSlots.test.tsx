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

it("puts a card's header elements beside its text, across the full card", () => {
  // As saved in the editor: the header slot set to a one-column grid,
  // holding an arrow icon.
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    slots: {
      body: { elements: [createConceptElement("badge")] },
      header: {
        columns: 1,
        elements: [
          { ...createConceptElement("icon"), iconName: "ArrowRight01Icon" },
        ],
        layout: "grid",
      },
    },
    text: "LMX-318\nLab based project test",
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  const article = host.querySelector("article") as HTMLElement;
  const header = host.querySelector<HTMLElement>('[data-slot="header"]');
  const icon = host.querySelector<HTMLElement>('[role="img"]');
  const title = host.querySelector("strong") as HTMLElement;
  const badge = host.querySelector<HTMLElement>('[data-slot="body"]');
  const inner = article.getBoundingClientRect();
  const padding = Number.parseFloat(getComputedStyle(article).paddingRight);
  // The header spans the card.
  expect(header?.getBoundingClientRect().width).toBeCloseTo(
    inner.width - 2 * padding - 2,
    0
  );
  // The icon is in the header: right of the text, at the card's far edge,
  // above the body slot.
  const iconBox = icon?.getBoundingClientRect();
  expect(iconBox?.left).toBeGreaterThan(title.getBoundingClientRect().right);
  expect(inner.right - padding - (iconBox?.right ?? 0)).toBeLessThan(4);
  expect(iconBox?.bottom).toBeLessThan(badge?.getBoundingClientRect().top ?? 0);
});

it("fills a slot's width with its elements when asked", () => {
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    slots: {
      footer: {
        elements: [
          createConceptElement("input"),
          createConceptElement("select"),
        ],
        fill: true,
        gap: 8,
        layout: "row",
      },
    },
    text: "Awaiting Review",
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  const footer = host.querySelector<HTMLElement>(
    '[data-slot="footer"] > .concept-slot__items'
  ) as HTMLElement;
  const items = [...footer.children].map((child) =>
    (child.classList.contains("concept-hover")
      ? (child.firstElementChild as HTMLElement)
      : (child as HTMLElement)
    ).getBoundingClientRect()
  );
  const box = footer.getBoundingClientRect();
  // Side by side, from edge to edge, sharing the width.
  expect(items[0].left - box.left).toBeLessThan(1);
  expect(box.right - items[1].right).toBeLessThan(1);
  expect(Math.abs(items[0].width - items[1].width)).toBeLessThan(2);
});

it("draws no header for a card with no text and nothing in its header", () => {
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    iconName: undefined,
    slots: { body: { elements: [createConceptElement("badge")] } },
    text: "",
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  expect(host.querySelector('[data-slot="header"]')).toBeNull();
  expect(host.querySelector('[data-slot="body"]')).not.toBeNull();
});
