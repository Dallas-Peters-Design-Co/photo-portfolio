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
  // The new style opens, ready to style; the parent's stays folded.
  expect(
    host.querySelector('[aria-label="Fold Badge Primary"]')
  ).not.toBeNull();
  expect(
    host.querySelector('[aria-label="Open Button Primary"]')
  ).not.toBeNull();
  host.remove();
});

function OneCard() {
  const [doc, setDoc] = useState<BrandKitDoc>({
    ...EMPTY_KIT,
    componentStyles: [{ id: "c1", kind: "card", look: {}, name: "Card" }],
  });
  saved = doc;
  return <BrandKitComponents doc={doc} effective={doc} onChange={setDoc} />;
}

it("keeps the icon picked for a style", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<OneCard />));
  // Styles start folded; open this one.
  expect(host.querySelector('[aria-label="Card icon"]')).toBeNull();
  await userEvent.click(
    host.querySelector('[aria-label="Open Card Card"]') as HTMLElement
  );
  await userEvent.click(
    host.querySelector('[aria-label="Card icon"]') as HTMLElement
  );
  await userEvent.click(
    host.querySelector('[role="option"][title="Favourite"]') as HTMLElement
  );
  expect(saved.componentStyles[0]?.look.iconName).toBe("FavouriteIcon");
  expect(saved.componentStyles[0]?.look.iconSvg).toBeTruthy();
  expect(host.querySelector('[aria-label="Card icon"]')?.textContent).toContain(
    "Favourite"
  );
  host.remove();
});
