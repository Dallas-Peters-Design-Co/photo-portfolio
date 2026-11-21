import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import type { ConceptSlotLayout } from "../../../config/conceptSlots.js";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

it.each<ConceptSlotLayout>(["column", "row", "grid"])(
  "fills the available space for a group in a %s card body",
  async (layout) => {
    const group = {
      ...createConceptElement("group"),
      group: { elements: [createConceptElement("label")] },
    };
    const card = {
      ...createConceptElement("card"),
      slots: {
        body: {
          columns: 2,
          elements: [group, createConceptElement("badge")],
          gap: 12,
          layout,
          paddingX: 16,
        },
      },
    };
    const host = document.createElement("div");
    document.body.append(host);
    host.style.width = "720px";
    const root = createRoot(host);
    try {
      await act(() => root.render(<ReviewConceptElementView element={card} />));
      const items = host.querySelector(
        '.concept-slot[data-slot="body"] > .concept-slot__items'
      );
      const bounds = items?.getBoundingClientRect();
      const groupBox = items
        ?.querySelector(".concept-group")
        ?.getBoundingClientRect();
      const siblingBox = items?.lastElementChild?.getBoundingClientRect();
      if (!(bounds && groupBox && siblingBox)) {
        throw new Error("Missing card body content");
      }
      expect(groupBox.left).toBeCloseTo(bounds.left, 0);
      const right = layout === "column" ? bounds.right : siblingBox.left - 12;
      expect(groupBox.right).toBeCloseTo(right, 0);
    } finally {
      await act(() => root.unmount());
      host.remove();
    }
  }
);
