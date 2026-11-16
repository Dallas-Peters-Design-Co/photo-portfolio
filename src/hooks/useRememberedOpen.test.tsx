import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { ReviewConceptElement } from "../../config/reviewConcept.js";
import { createConceptElement } from "../components/admin/ReviewConceptBrand";
import { ReviewConceptElementFields } from "../components/admin/ReviewConceptElementFields";
import { rememberedOpen, rememberOpen } from "./useRememberedOpen";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.removeItem("admin-open-items");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.removeItem("admin-open-items");
});

const draw = (element: ReviewConceptElement, depth = 0) =>
  act(() =>
    root.render(
      <ReviewConceptElementFields
        depth={depth}
        element={element}
        onChange={() => undefined}
      />
    )
  );

const toggle = () =>
  host.querySelector<HTMLButtonElement>(".review-concepts__element-toggle");

const reload = () => {
  act(() => root.unmount());
  root = createRoot(host);
};

it("opens an element after a reload the way it was left", () => {
  const button = createConceptElement("button");
  draw(button);
  expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
  act(() => toggle()?.click());
  expect(toggle()?.getAttribute("aria-expanded")).toBe("false");

  reload();
  draw(button);
  expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
});

it("keeps an element in a slot open after a reload once it is opened", () => {
  const badge = createConceptElement("badge");
  draw(badge, 1);
  expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
  act(() => toggle()?.click());

  reload();
  draw(badge, 1);
  expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
});

it("forgets the oldest items past its cap", () => {
  for (let n = 0; n < 610; n += 1) {
    rememberOpen(`item-${n}`, true);
  }
  expect(rememberedOpen("item-0")).toBeUndefined();
  expect(rememberedOpen("item-609")).toBe(true);
});
