import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createConceptElement } from "../admin/ReviewConceptBrand";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);

afterEach(() => act(() => root.render(null)));

const search: [string, Record<string, string | number>][] = [
  ["circle", { cx: 11, cy: 11, r: 7 }],
  ["path", { d: "M20 20l-4-4" }],
];

it("draws an input's icon inside its box, beside the text field", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("input"),
          iconName: "Search01Icon",
          iconSvg: search,
        }}
      />
    )
  );
  const field = host.querySelector("input");
  const box = field?.parentElement;
  expect(box?.querySelector("svg")).not.toBeNull();
  // The box has the border, the field inside it does not.
  expect(getComputedStyle(box as HTMLElement).borderTopStyle).toBe("solid");
  expect(getComputedStyle(field as HTMLElement).borderTopStyle).toBe("none");
});

it("draws a plain input when it has no icon", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView element={createConceptElement("input")} />
    )
  );
  expect(host.querySelector("input")?.parentElement).toBe(host);
  expect(host.querySelector("svg")).toBeNull();
});

it("draws a select with the project Select: it opens, picks, and keeps the design", async () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("select"),
          background: "#ffeedd",
          options: ["Overview", "Settings"],
        }}
      />
    )
  );
  const trigger = host.querySelector('[data-slot="select-trigger"]');
  expect(trigger?.textContent).toContain("Choose an option");
  // Shown as the value, at full strength: not a faded placeholder.
  expect(trigger?.hasAttribute("data-placeholder")).toBe(false);
  expect(getComputedStyle(trigger as HTMLElement).opacity).toBe("1");
  expect(getComputedStyle(trigger as HTMLElement).backgroundColor).toBe(
    "rgb(255, 238, 221)"
  );

  await userEvent.click(trigger as HTMLElement);
  const settings = await vi.waitFor(() => {
    const option = [...document.querySelectorAll('[role="option"]')].find(
      (item) => item.textContent === "Settings"
    );
    if (!option) {
      throw new Error("Menu not open");
    }
    return option as HTMLElement;
  });
  await userEvent.click(settings);
  await vi.waitFor(() => expect(trigger?.textContent).toContain("Settings"));
});

it("draws a dropdown menu with the project DropdownMenu, which opens on click", async () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("menu"),
          options: ["Rename", "Delete"],
        }}
      />
    )
  );
  const trigger = host.querySelector('[data-slot="dropdown-menu-trigger"]');
  expect(trigger?.textContent).toContain("Actions");
  await userEvent.click(trigger as HTMLElement);
  await vi.waitFor(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')].map(
      (item) => item.textContent
    );
    expect(items).toEqual(["Rename", "Delete"]);
  });
});

it("draws a badge with its fill, text color and border", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("badge"),
          background: "#ffeedd",
          borderColor: "#ff0000",
          borderWidth: 2,
          color: "#0000ff",
        }}
      />
    )
  );
  const badge = getComputedStyle(host.querySelector("span") as HTMLElement);
  expect(badge.backgroundColor).toBe("rgb(255, 238, 221)");
  expect(badge.color).toBe("rgb(0, 0, 255)");
  expect(badge.borderTopWidth).toBe("2px");
  expect(badge.borderTopColor).toBe("rgb(255, 0, 0)");
});

it("draws a checkbox in its accent colour and box size", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("checkbox"),
          accentColor: "#ff0000",
          checkSize: 24,
        }}
      />
    )
  );
  const box = getComputedStyle(
    host.querySelector('input[type="checkbox"]') as HTMLElement
  );
  expect(box.accentColor).toBe("rgb(255, 0, 0)");
  expect(box.width).toBe("24px");
});

it("draws a button's border and shadow, and keeps a field's faint outline until set", () => {
  act(() =>
    root.render(
      <>
        <ReviewConceptElementView
          element={{
            ...createConceptElement("button"),
            borderColor: "#ff0000",
            borderWidth: 3,
            shadow: {
              blur: 10,
              color: "#000000",
              opacity: 30,
              spread: 0,
              x: 0,
              y: 4,
            },
          }}
        />
        <ReviewConceptElementView element={createConceptElement("textarea")} />
      </>
    )
  );
  const button = getComputedStyle(host.querySelector("button") as HTMLElement);
  expect(button.borderTopWidth).toBe("3px");
  expect(button.borderTopColor).toBe("rgb(255, 0, 0)");
  expect(button.boxShadow).not.toBe("none");
  const field = getComputedStyle(host.querySelector("textarea") as HTMLElement);
  expect(field.borderTopWidth).toBe("1px");
  expect(field.boxShadow).toBe("none");
});

it("draws tabs with their indicator, active and inactive colours and height", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("tabs"),
          tabLook: {
            activeColor: "#0000ff",
            height: 48,
            inactiveColor: "#999999",
            indicatorColor: "#ff0000",
            indicatorSize: 4,
          },
        }}
      />
    )
  );
  const active = host.querySelector('[aria-current="page"]') as HTMLElement;
  const other = host.querySelector(
    ".concept-tabs__tab:not([aria-current])"
  ) as HTMLElement;
  expect(getComputedStyle(active).color).toBe("rgb(0, 0, 255)");
  expect(getComputedStyle(other).color).toBe("rgb(153, 153, 153)");
  const line = getComputedStyle(active, "::after");
  expect(line.height).toBe("4px");
  expect(line.backgroundColor).toBe("rgb(255, 0, 0)");
  expect(
    (host.querySelector(".concept-tabs") as HTMLElement).getBoundingClientRect()
      .height
  ).toBeGreaterThanOrEqual(48);
});

it("puts a tab element's side padding on each tab, not the row", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{ ...createConceptElement("tabs"), paddingX: 20, paddingY: 6 }}
      />
    )
  );
  const row = getComputedStyle(
    host.querySelector(".concept-tabs") as HTMLElement
  );
  const tab = getComputedStyle(
    host.querySelector(".concept-tabs__tab") as HTMLElement
  );
  expect(row.paddingLeft).toBe("0px");
  expect(row.paddingTop).toBe("6px");
  expect(tab.paddingLeft).toBe("20px");
  expect(tab.paddingRight).toBe("20px");
});

it("draws a toast's action in its colour and a close button, each optional", () => {
  const toast = createConceptElement("toast");
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{ ...toast, accentColor: "#ff0000" }}
      />
    )
  );
  const action = host.querySelector(".concept-toast__action") as HTMLElement;
  expect(action.textContent).toBe("Undo");
  expect(getComputedStyle(action).color).toBe("rgb(255, 0, 0)");
  expect(host.querySelector('[aria-label="Close"]')).not.toBeNull();

  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{ ...toast, toastAction: "", toastClose: false }}
      />
    )
  );
  expect(host.querySelector(".concept-toast__action")).toBeNull();
  expect(host.querySelector('[aria-label="Close"]')).toBeNull();
});

it("changes a button's fill and text under the pointer, and only then", async () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("button"),
          background: "#000000",
          color: "#ffffff",
          hover: { background: "#ff0000", color: "#000000" },
        }}
      />
    )
  );
  const button = host.querySelector("button") as HTMLElement;
  expect(getComputedStyle(button).backgroundColor).toBe("rgb(0, 0, 0)");
  await userEvent.hover(button);
  await vi.waitFor(() =>
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(255, 0, 0)")
  );
  expect(getComputedStyle(button).color).toBe("rgb(0, 0, 0)");
  await userEvent.unhover(button);
});

it("colours a tab that is not selected under the pointer", async () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("tabs"),
          hover: { color: "#ff0000" },
        }}
      />
    )
  );
  const other = host.querySelector(
    ".concept-tabs__tab:not([aria-current])"
  ) as HTMLElement;
  await userEvent.hover(other);
  await vi.waitFor(() =>
    expect(getComputedStyle(other).color).toBe("rgb(255, 0, 0)")
  );
  await userEvent.unhover(other);
});

it("colours a card's icon, and changes it under the pointer", async () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("card"),
          hover: { iconColor: "#ff0000" },
          iconColor: "#0000ff",
          iconName: "StarIcon",
          iconSvg: [["path", { d: "M1 1h2", stroke: "currentColor" }]],
        }}
      />
    )
  );
  const card = host.querySelector("article") as HTMLElement;
  const icon = card.querySelector("svg") as SVGElement;
  expect(getComputedStyle(icon).color).toBe("rgb(0, 0, 255)");
  await userEvent.hover(card);
  await vi.waitFor(() =>
    expect(getComputedStyle(icon).color).toBe("rgb(255, 0, 0)")
  );
  await userEvent.unhover(card);
});
