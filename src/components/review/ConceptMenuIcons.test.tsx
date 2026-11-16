import "../../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  cleanConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
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
