import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ConceptColorField } from "./ReviewConceptBrand";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let picked = "";
function Field() {
  const [value, setValue] = useState("#ff0000");
  picked = value;
  return (
    <ConceptColorField
      ariaLabel="Fill"
      label="Fill"
      onChange={setValue}
      value={value}
    />
  );
}

it("opens the OKLCH picker and takes a typed colour", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<Field />));
  expect(host.querySelector('input[type="color"]')).toBeNull();
  await userEvent.click(
    host.querySelector('[aria-label="Fill"]') as HTMLElement
  );
  expect(
    document.querySelector('[aria-label="Lightness and chroma"]')
  ).not.toBeNull();
  // Concept colours may be see-through: the alpha strip is offered.
  expect(document.querySelector('[aria-label="Alpha"]')).not.toBeNull();
  const field = document.querySelector(".oklch__text") as HTMLInputElement;
  await userEvent.clear(field);
  await userEvent.type(field, "#00ff00{Enter}");
  expect(picked.toLowerCase()).toBe("#00ff00");
  host.remove();
});
