import "../../index.css";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import type { ConceptSlot } from "../../../config/conceptSlots.js";
import { ConceptGroup, NumberField } from "./ConceptControls";
import { SlotFields } from "./ConceptSlotFields";
import { ConceptColorField } from "./ReviewConceptBrand";
import "./ReviewConceptsEditor.css";

function Inspector({ layout }: { layout: "column" | "row" }) {
  const [slot, setSlot] = useState<ConceptSlot>({ elements: [], layout });
  const [color, setColor] = useState("#112233");
  return (
    <>
      <ConceptGroup compact name="Color">
        <ConceptColorField
          allowNone
          ariaLabel="Text color"
          label="Text"
          onChange={setColor}
          value={color}
        />
        <ConceptColorField
          ariaLabel="Fill color"
          label="Fill"
          onChange={setColor}
          value={color}
        />
        <NumberField
          label="Size"
          max={100}
          onChange={() => undefined}
          value={16}
        />
      </ConceptGroup>
      <SlotFields depth={0} label="Header" onChange={setSlot} slot={slot} />
      <output>{[slot.align, slot.justify, color].join("/")}</output>
    </>
  );
}

it("packs swatches and numbers together and maps all nine flex positions to the layout axes", async () => {
  const host = document.createElement("div");
  host.style.width = "300px";
  host.className = "review-concepts__element";
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() => root.render(<Inspector layout="row" />));
    const colors = [...host.querySelectorAll(".color-well__swatch")].map((el) =>
      el.getBoundingClientRect()
    );
    expect(colors[0]?.top).toBe(colors[1]?.top);
    expect(
      host.querySelector('[aria-label="Size"]')?.getBoundingClientRect().width
    ).toBeLessThan(75);
    await page.getByRole("button", { exact: true, name: "Text color" }).click();
    await page.getByRole("button", { exact: true, name: "No color" }).click();
    expect(host.querySelector("output")?.textContent).toContain("transparent");
    for (const layout of ["row", "column"] as const) {
      act(() => root.render(<Inspector key={layout} layout={layout} />));
      const positions = [
        ...host.querySelectorAll<HTMLButtonElement>(
          ".concept-alignment__grid button"
        ),
      ];
      expect(positions).toHaveLength(9);
      for (const [i, button] of positions.entries()) {
        act(() => button.click());
        const axes = ["start", "center", "end"];
        const x = axes[i % 3];
        const y = axes[Math.floor(i / 3)];
        expect(host.querySelector("output")?.textContent).toBe(
          [...(layout === "row" ? [y, x] : [x, y]), "#112233"].join("/")
        );
        expect(button.getAttribute("aria-pressed")).toBe("true");
      }
    }
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});

it("exposes the state selector on an existing Cards group and updates its starting state", async () => {
  let slot: ConceptSlot = {
    disclosureLabel: "Cards",
    elements: [],
    stateful: true,
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() =>
      root.render(
        <SlotFields
          depth={0}
          group
          onChange={(next) => {
            slot = next;
          }}
          slot={slot}
        />
      )
    );
    await page
      .getByRole("combobox", { exact: true, name: "Component state" })
      .click();
    await page.getByRole("option", { name: "Collapsed" }).click();
    expect(slot.initialState).toBe(1);
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
