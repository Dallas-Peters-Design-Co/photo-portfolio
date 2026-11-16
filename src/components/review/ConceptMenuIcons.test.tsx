import "../../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  cleanConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { IconPicker } from "../../cms/IconPicker";
import { createConceptElement } from "../admin/ReviewConceptBrand";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

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

const rgb = (hex: string) => {
  const probe = document.createElement("i");
  probe.style.color = hex;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
};

it("opens a select's list in its own look, not the admin's dark one", async () => {
  const select: ReviewConceptElement = {
    ...createConceptElement("select"),
    background: "#f2f2f2",
    color: "#111111",
    menuLook: { highlight: "#ffe08a", highlightColor: "#5a3d00" },
    options: ["Complete", "In progress"],
    text: "Choose an option",
  };
  act(() => root.render(<ReviewConceptElementView element={select} />));
  const trigger = host.querySelector<HTMLElement>("[data-slot=select-trigger]");
  await userEvent.click(trigger as HTMLElement);
  const list = document.querySelector<HTMLElement>("[data-concept-menu]");
  expect(list).not.toBeNull();
  const look = getComputedStyle(list as HTMLElement);
  expect(look.backgroundColor).toBe(rgb("#f2f2f2"));
  expect(look.color).toBe(rgb("#111111"));

  const row = [
    ...document.querySelectorAll<HTMLElement>("[data-slot=select-item]"),
  ].find((item) => item.textContent === "Complete");
  await userEvent.hover(row as HTMLElement);
  await expect.poll(() => row?.hasAttribute("data-highlighted")).toBe(true);
  expect(getComputedStyle(row as HTMLElement).backgroundColor).toBe(
    rgb("#ffe08a")
  );
  expect(getComputedStyle(row as HTMLElement).color).toBe(rgb("#5a3d00"));
  await userEvent.keyboard("{Escape}");
});

it("draws a button's icon slots either side of its text", () => {
  const button: ReviewConceptElement = {
    ...createConceptElement("button"),
    iconEndName: "ArrowRight01Icon",
    iconName: "Add01Icon",
    text: "New item",
  };
  act(() => root.render(<ReviewConceptElementView element={button} />));
  const el = host.querySelector("button") as HTMLElement;
  // Start icon, text, end icon: the icons are decoration, the text names it.
  const [start, label, end] = [...el.children];
  expect(el.children).toHaveLength(3);
  expect(start?.getAttribute("aria-hidden")).toBe("true");
  expect(label?.textContent).toBe("New item");
  expect(end?.getAttribute("aria-hidden")).toBe("true");
});

it("makes a button with an icon and no text icon-only, named by its icon", () => {
  const button: ReviewConceptElement = {
    ...createConceptElement("button"),
    iconName: "Delete02Icon",
    text: "",
  };
  act(() => root.render(<ReviewConceptElementView element={button} />));
  const el = host.querySelector("button") as HTMLElement;
  expect(el.getAttribute("aria-label")).toBe("Delete02");
  expect(el.textContent).toBe("");
});

it("keeps end icons on buttons, badges and tags, and a list look on selects", () => {
  const concept = cleanConcept({
    elements: [
      { iconEndName: "Cancel01Icon", kind: "tag", text: "Design" },
      { iconEndName: "Cancel01Icon", kind: "badge", text: "New" },
      { iconEndName: "Cancel01Icon", kind: "text", text: "Plain" },
      { kind: "select", menuLook: { highlight: "#ffe08a", radius: 99 } },
      { kind: "button", menuLook: { highlight: "#ffe08a" } },
    ],
  });
  const [tag, badge, text, select, button] = concept.elements;
  expect(tag?.kind).toBe("tag");
  expect(tag?.iconEndName).toBe("Cancel01Icon");
  expect(badge?.iconEndName).toBe("Cancel01Icon");
  expect(text?.iconEndName).toBeUndefined();
  expect(select?.menuLook).toEqual({ highlight: "#ffe08a", radius: 32 });
  expect(button?.menuLook).toBeUndefined();
});

it("keeps a long icon name on one line in a narrow table cell", () => {
  host.style.width = "120px";
  act(() =>
    root.render(
      <IconPicker
        label="Row 1, Actions"
        onChange={() => undefined}
        size="sm"
        value="MoreHorizontalIcon"
      />
    )
  );
  const trigger = host.querySelector("button") as HTMLElement;
  const name = trigger.querySelector("span span") as HTMLElement;
  // One line: as tall as the trigger allows, and no wider than it.
  expect(name.getBoundingClientRect().height).toBeLessThan(24);
  expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth + 1);
});

it("keeps a badge's and tag's label on one line beside long text", () => {
  const long =
    "Real-world effectiveness of biologic DMARD therapies in newly diagnosed RA";
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    slots: {
      header: {
        elements: [
          { ...createConceptElement("badge"), text: "In Progress" },
          { ...createConceptElement("tag"), text: "In Progress" },
        ],
        layout: "row",
      },
    },
    text: `${long} ${long}`,
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  for (const pill of host.querySelectorAll<HTMLElement>(
    "[data-slot=header] .concept-slot__items > span"
  )) {
    // One line box for the whole label: it did not break.
    const range = document.createRange();
    range.selectNodeContents(pill.querySelector("span") as HTMLElement);
    expect(range.getClientRects()).toHaveLength(1);
  }
});

it("keeps each tab's label on one line in a narrow row", () => {
  host.style.width = "160px";
  const tabs: ReviewConceptElement = {
    ...createConceptElement("tabs"),
    options: ["All projects", "In progress", "Awaiting review"],
  };
  act(() => root.render(<ReviewConceptElementView element={tabs} />));
  const labels = [...host.querySelectorAll<HTMLElement>(".concept-tabs__tab")];
  expect(labels.length).toBeGreaterThan(1);
  for (const tab of labels) {
    const range = document.createRange();
    range.selectNodeContents(tab);
    expect(range.getClientRects()).toHaveLength(1);
  }
});

it("slides the tab indicator to the tab clicked", async () => {
  const tabs: ReviewConceptElement = {
    ...createConceptElement("tabs"),
    options: ["Overview", "Activity", "Settings"],
    text: "Overview",
  };
  act(() => root.render(<ReviewConceptElementView element={tabs} />));
  const indicator = () =>
    host.querySelector<HTMLElement>(".concept-tabs__indicator");
  const tab = (name: string) =>
    [...host.querySelectorAll<HTMLElement>(".concept-tabs__tab")].find(
      (button) => button.textContent === name
    ) as HTMLElement;
  // Under the starting tab, its full width.
  expect(indicator()?.style.width).toBe(`${tab("Overview").offsetWidth}px`);
  // It moves by animating, not by jumping.
  expect(
    getComputedStyle(indicator() as HTMLElement).transitionProperty
  ).toContain("transform");

  await userEvent.click(tab("Settings"));
  expect(tab("Settings").getAttribute("aria-current")).toBe("page");
  expect(tab("Overview").hasAttribute("aria-current")).toBe(false);
  expect(indicator()?.style.transform).toBe(
    `translateX(${tab("Settings").offsetLeft}px)`
  );
  expect(indicator()?.style.width).toBe(`${tab("Settings").offsetWidth}px`);
});

it("draws a card's title in its own weight, bolder than the body without one", () => {
  const card: ReviewConceptElement = {
    ...createConceptElement("card"),
    fontWeight: 400,
    text: "LMX-318\nLab based project test",
  };
  act(() => root.render(<ReviewConceptElementView element={card} />));
  const title = () => host.querySelector("strong") as HTMLElement;
  expect(Number(getComputedStyle(title()).fontWeight)).toBe(700);
  act(() =>
    root.render(
      <ReviewConceptElementView element={{ ...card, titleWeight: 500 }} />
    )
  );
  expect(Number(getComputedStyle(title()).fontWeight)).toBe(500);
});

it("keeps a column's width in range and a card's title weight", () => {
  const concept = cleanConcept({
    elements: [
      {
        kind: "table",
        table: {
          columns: [
            { kind: "text", label: "A", width: 10 },
            { kind: "text", label: "B", width: 9999 },
            { kind: "text", label: "C", width: 0 },
          ],
          rows: [],
        },
      },
      { kind: "card", text: "Title", titleWeight: 500 },
      { kind: "card", text: "Title", titleWeight: 650 },
    ],
  });
  const [table, card, odd] = concept.elements;
  expect(table?.table?.columns.map((column) => column.width)).toEqual([
    40,
    640,
    undefined,
  ]);
  expect(card?.titleWeight).toBe(500);
  expect(odd?.titleWeight).toBeUndefined();
});
