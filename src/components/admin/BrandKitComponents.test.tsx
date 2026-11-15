import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type BrandKitDoc, EMPTY_KIT } from "../../../config/brandKit.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import { BrandKitComponents } from "./BrandKitComponents";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const parentStyle: ConceptStyle = {
  id: "p1",
  kind: "button",
  look: { background: "#ff0000" },
  name: "Primary",
};

let saved: BrandKitDoc = EMPTY_KIT;

function SubBrand() {
  const [doc, setDoc] = useState<BrandKitDoc>(EMPTY_KIT);
  saved = doc;
  return (
    <BrandKitComponents
      doc={doc}
      effective={{
        ...doc,
        componentStyles:
          doc.componentStyles.length > 0 ? doc.componentStyles : [parentStyle],
      }}
      onChange={setDoc}
    />
  );
}

it("keeps the parent's styles when a sub-brand adds its first own", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<SubBrand />));
  await userEvent.click(
    host.querySelector('[aria-label="Add a component style"]') as HTMLElement
  );
  const badge = await vi.waitFor(() => {
    const found = [...document.querySelectorAll('[role="option"]')].find(
      (option) => option.textContent === "Badge"
    );
    if (!found) {
      throw new Error("menu not open");
    }
    return found as HTMLElement;
  });
  await userEvent.click(badge);
  expect(saved.componentStyles.map((style) => style.id)[0]).toBe("p1");
  expect(saved.componentStyles.map((style) => style.kind)).toEqual([
    "button",
    "badge",
  ]);
  host.remove();
});
