import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import type { ReviewConcept } from "../../../config/reviewConcept.js";
import { createConcept } from "./ReviewConceptBrand";
import { ReviewConceptsEditor } from "./ReviewConceptsEditor";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** A concept element follows a brand kit style until it sets something itself. */

const primary: ConceptStyle = {
  id: "primary",
  kind: "button",
  look: {
    background: "#ff0000",
    color: "#ffffff",
    fontFamily: "sans",
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
    paddingX: 20,
    paddingY: 10,
    radius: 999,
  },
  name: "Primary",
};

let saved: ReviewConcept[] = [];

function Harness() {
  const [concepts, setConcepts] = useState<ReviewConcept[]>(() => [
    { ...createConcept(), elements: [] },
  ]);
  saved = concepts;
  return (
    <ReviewConceptsEditor
      brandDoc={{ ...EMPTY_KIT, componentStyles: [primary] }}
      concepts={concepts}
      onChange={setConcepts}
    />
  );
}

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const option = (text: string) =>
  vi.waitFor(() => {
    const found = [...document.querySelectorAll('[role="option"]')].find(
      (item) => item.textContent === text
    );
    if (!found) {
      throw new Error(`No option "${text}"`);
    }
    return found as HTMLElement;
  });

it("adds a kit style linked, marks an edit as its own, and resets it", async () => {
  await userEvent.click(
    host.querySelector('[aria-label="Add a component"]') as HTMLElement
  );
  await userEvent.click(await option("Button · Primary"));

  const element = () => saved[0]?.elements[0];
  expect(element()).toMatchObject({
    background: "#ff0000",
    styleId: "primary",
  });

  const size = host.querySelector('[aria-label="Size"]') as HTMLInputElement;
  await userEvent.clear(size);
  await userEvent.type(size, "24");
  expect(element()?.overrides).toEqual(["fontSize"]);

  const reset = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Reset")
  );
  expect(reset?.textContent).toContain("1 change");
  await userEvent.click(reset as HTMLElement);
  expect(element()?.overrides).toBeUndefined();
  expect(element()?.fontSize).toBe(18);
});
