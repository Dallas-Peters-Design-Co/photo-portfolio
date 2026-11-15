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
