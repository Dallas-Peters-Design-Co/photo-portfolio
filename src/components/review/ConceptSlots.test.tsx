import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  cleanConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { ReviewConceptElementFields } from "../admin/ReviewConceptElementFields";
import { ReviewConceptElementView } from "./ReviewConceptElementView";
import { ReviewConceptPreview } from "./ReviewConceptPreview";

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
  const [title, count] = [
    ...(header?.querySelector(".concept-slot__items")?.children ?? []),
  ] as HTMLElement[];
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
  // Close button, header, body, footer.
  const [, , bodyGap] = gaps;
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

it("keeps a large close button beside the panel header instead of over its badge", () => {
  host.style.width = "300px";
  const panel = createConceptElement("panel");
  const close = panel.slots?.hide?.elements[0];
  if (!(close && panel.slots?.hide)) {
    throw new Error("Panel has no close button");
  }
  close.paddingX = 24;
  act(() => root.render(<ReviewConceptElementView element={panel} />));
  const badge = host.querySelector<HTMLElement>(
    '.concept-slot[data-slot="header"] .concept-slot__items'
  );
  const button = host.querySelector<HTMLElement>(".concept-panel__hide");
  expect(badge?.getBoundingClientRect().right).toBeLessThanOrEqual(
    button?.getBoundingClientRect().left ?? 0
  );
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

it.each([
  ["Awaiting Review", false],
  // As saved in the editor: a space typed to clear the title.
  [" ", true],
])(
  "fills a slot's width with its elements when asked (title %j)",
  (text, edgeToEdge) => {
    const card: ReviewConceptElement = {
      ...createConceptElement("card"),
      iconName: undefined,
      slots: {
        // As saved in the editor: two fields in a two-column grid header.
        header: {
          columns: 2,
          elements: [
            createConceptElement("input"),
            createConceptElement("select"),
          ],
          fill: true,
          gap: 14,
          justify: "end",
          layout: "grid",
        },
      },
      text,
    };
    act(() => root.render(<ReviewConceptElementView element={card} />));
    const footer = host.querySelector<HTMLElement>(
      '[data-slot="header"] > .concept-slot__items'
    ) as HTMLElement;
    const slot = footer.parentElement as HTMLElement;
    const items = [...footer.children].map((child) =>
      (child.classList.contains("concept-hover")
        ? (child.firstElementChild as HTMLElement)
        : (child as HTMLElement)
      ).getBoundingClientRect()
    );
    const box = footer.getBoundingClientRect();
    // With no text, the fields span the whole header; with a title, they
    // share the width beside it.
    const across = Math.abs(box.width - slot.getBoundingClientRect().width) < 1;
    expect(across).toBe(edgeToEdge);
    // Side by side, from edge to edge, sharing the width.
    expect(items[0].left - box.left).toBeLessThan(1);
    expect(box.right - items[1].right).toBeLessThan(1);
    expect(Math.abs(items[0].width - items[1].width)).toBeLessThan(2);
  }
);

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

it("moves an element up or down its list with the handle's arrow keys", () => {
  act(() => root.render(<Harness />));
  const footerKinds = () =>
    [...host.querySelectorAll<HTMLElement>(".review-concepts__element")]
      .map((section) => section.getAttribute("aria-label"))
      .filter((kind) => kind === "progress" || kind === "checkbox");
  expect(footerKinds()).toEqual(["progress", "checkbox"]);
  const handle = host.querySelector<HTMLButtonElement>(
    'button[aria-label^="Move Checkbox"]'
  );
  act(() => {
    handle?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" })
    );
  });
  expect(footerKinds()).toEqual(["checkbox", "progress"]);
});

it("keeps a card's header row on one line beside long text", () => {
  // As saved: a header row (stretched) holding a badge and an arrow, on a
  // card whose body runs long.
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    slots: {
      header: {
        align: "stretch",
        elements: [
          { ...createConceptElement("badge"), text: "In Progress" },
          { ...createConceptElement("icon"), iconName: "ArrowRight01Icon" },
        ],
        layout: "row",
      },
    },
    text: "RA DMARD Vin Thesis\nObservational pharmacoeconomic study of DMARD therapies in newly diagnosed RA patients",
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  const items = host.querySelector<HTMLElement>(
    "[data-slot=header] > .concept-slot__items"
  );
  const [badge, arrow] = [...(items?.children ?? [])].map((child) =>
    child.getBoundingClientRect()
  );
  // The arrow sits beside the badge, not under it.
  expect(arrow?.left).toBeGreaterThanOrEqual(badge?.right ?? 0);
  expect(arrow?.top).toBeLessThan(badge?.bottom ?? 0);
});

it("keeps a header's badge beside a card's text when the card is narrow", () => {
  host.style.width = "300px";
  // As in the editor: a title, a body, and a long badge in the header.
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    iconName: undefined,
    slots: {
      header: {
        elements: [
          {
            ...createConceptElement("badge"),
            fontSize: 22,
            text: "5 pending review",
          },
        ],
        layout: "row",
      },
    },
    text: "Results & Findings\nReview parsed results",
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  const text = host
    .querySelector(".concept-slot__lead")
    ?.getBoundingClientRect() as DOMRect;
  const badge = host
    .querySelector('[data-slot="header"] > .concept-slot__items')
    ?.getBoundingClientRect() as DOMRect;
  // One row: the badge stays at the end, beside the text, never over it;
  // the text wraps in the width left to it.
  expect(badge.left).toBeGreaterThanOrEqual(text.right - 1);
  expect(badge.top).toBeLessThan(text.bottom);
  const box = host.querySelector(".review-concepts__card-preview");
  expect(badge.right).toBeLessThanOrEqual(
    (box?.getBoundingClientRect().right ?? 0) + 1
  );
});

it("keeps a scrolling row of cards on one line, each its set width", () => {
  host.style.width = "600px";
  const card = (id: string): ReviewConceptElement => ({
    ...createConceptElement("card"),
    id,
    text: "Evidence Screening\nSearch and screen literature",
  });
  act(() =>
    root.render(
      <ReviewConceptPreview
        concept={cleanConcept({
          direction: "row",
          elements: ["a", "b", "c", "d", "e"].map(card),
          itemWidth: 240,
          scroll: true,
        })}
      />
    )
  );
  const row = host.querySelector<HTMLElement>(".concept-canvas") as HTMLElement;
  const cards = [...host.querySelectorAll<HTMLElement>("article")];
  const tops = new Set(
    cards.map((c) => Math.round(c.getBoundingClientRect().top))
  );
  // One line, each card 240px, scrolling rather than wrapping.
  expect(tops.size).toBe(1);
  for (const c of cards) {
    expect(c.getBoundingClientRect().width).toBeCloseTo(240, 0);
  }
  expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
  expect(getComputedStyle(row).overflowX).toBe("auto");
});

it("keeps scroll only on a horizontal row", () => {
  const concept = cleanConcept({ direction: "row", scroll: true });
  expect(concept.scroll).toBe(true);
  expect(cleanConcept({ direction: "column", scroll: true }).scroll).toBe(
    undefined
  );
});

it("lays out the panel title and badge together when the header changes direction", () => {
  const panel = createConceptElement("panel");
  const header = panel.slots?.header;
  if (!header) {
    throw new Error("Missing default header");
  }
  for (const layout of ["row", "column"] as const) {
    const element = {
      ...panel,
      slots: { ...panel.slots, header: { ...header, layout } },
    };
    act(() => root.render(<ReviewConceptElementView element={element} />));
    const items = host.querySelector(
      '[data-slot="header"] .concept-slot__items'
    );
    const title = items?.firstElementChild;
    const badge = title?.nextElementSibling;
    if (!(title && badge)) {
      throw new Error("Missing title or badge in header layout");
    }
    expect(title.textContent).toBe(panel.text);
    if (layout === "column") {
      expect(badge.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        title.getBoundingClientRect().bottom
      );
    } else {
      expect(badge.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        title.getBoundingClientRect().right
      );
    }
  }
});

it("keeps the empty navbar middle slot and sizes its neighbors using saved flex settings", () => {
  const navbar = createConceptElement("navbar");
  const button = {
    ...createConceptElement("button"),
    flex: { basis: 100, grow: 2, shrink: 0 },
  };
  const element = cleanConcept({
    elements: [
      {
        ...navbar,
        slots: {
          body: { elements: [] },
          footer: navbar.slots?.footer,
          header: {
            elements: [button],
            flex: { basis: 0, grow: 1, shrink: 1 },
            layout: "row",
            wrap: false,
          },
        },
      },
    ],
  }).elements[0] as ReviewConceptElement;
  act(() => root.render(<ReviewConceptElementView element={element} />));
  const start = host.querySelector('[data-slot="header"]') as HTMLElement;
  const item = start.querySelector(".concept-flex-item") as HTMLElement;
  expect(getComputedStyle(start).flex).toBe("1 1 0px");
  expect(getComputedStyle(item).flex).toBe("2 0 100px");
  expect(getComputedStyle(item.parentElement as HTMLElement).flexWrap).toBe(
    "nowrap"
  );
  expect(host.querySelector('[data-slot="body"]')?.textContent).toBe("");
});

it("switches accordion states and keeps summary controls independent of the trigger", () => {
  const accordion = createConceptElement("accordion");
  const summary = { ...createConceptElement("button"), text: "Review" };
  const render = (expanded: boolean) =>
    act(() =>
      root.render(
        <ReviewConceptElementView
          element={{
            ...accordion,
            accordionExpanded: expanded,
            slots: { ...accordion.slots, header: { elements: [summary] } },
            summaryIconName: "InformationCircleIcon",
            summaryIconSvg: accordion.iconSvg,
          }}
        />
      )
    );
  render(false);
  const trigger = () =>
    host.querySelector<HTMLButtonElement>(".ui-accordion__trigger");
  expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
  const action = host.querySelector<HTMLButtonElement>(
    '[data-slot="header"] button'
  );
  expect(action?.textContent).toBe("Review");
  const leading = host.querySelector(".ui-accordion__label svg");
  const indicator = host.querySelector(".ui-accordion__indicator");
  if (!(leading && action && indicator)) {
    throw new Error("Missing accordion content");
  }
  expect(leading.getBoundingClientRect().right).toBeLessThanOrEqual(
    action.getBoundingClientRect().left
  );
  expect(action.getBoundingClientRect().right).toBeLessThanOrEqual(
    indicator.getBoundingClientRect().left
  );
  expect(trigger()?.contains(action)).toBe(false);
  act(() => action?.click());
  expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
  render(true);
  expect(trigger()?.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector('[data-slot="body"]')?.textContent).toBe("Details");
  act(() => trigger()?.click());
  expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
});
