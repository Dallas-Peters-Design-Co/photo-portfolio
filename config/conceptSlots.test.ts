import { expect, it } from "vitest";
import { everyElement } from "./conceptSlots.js";
import { type ConceptStyle, styleElement } from "./conceptStyle.js";
import { cleanConcept } from "./reviewConcept.js";

const button = { kind: "button", text: "Go" };

it("keeps each slot's layout and elements, clamped", () => {
  const [panel] = cleanConcept({
    elements: [
      {
        dividers: true,
        kind: "panel",
        slots: {
          body: {
            columns: 12,
            elements: [button, { kind: "progress", progress: 40 }],
            gap: -4,
            layout: "grid",
            paddingX: 99,
          },
          bogus: { elements: [button] },
          header: { align: "center", elements: [], justify: "between" },
        },
        text: "Agents",
      },
    ],
  }).elements;
  expect(panel?.dividers).toBe(true);
  expect(panel?.slots?.body).toMatchObject({
    columns: 6,
    gap: 0,
    layout: "grid",
    paddingX: 99,
  });
  expect(panel?.slots?.body?.elements.map((e) => e.kind)).toEqual([
    "button",
    "progress",
  ]);
  // An empty slot keeps the layout it was given.
  expect(panel?.slots?.header).toMatchObject({
    align: "center",
    elements: [],
    justify: "between",
  });
  expect(panel?.slots).not.toHaveProperty("bogus");
});

it("lets a panel hold a card with slots, and stops one level below that", () => {
  const deepest = { kind: "card", slots: { body: { elements: [button] } } };
  const [panel] = cleanConcept({
    elements: [
      {
        kind: "panel",
        slots: {
          body: {
            elements: [
              { kind: "card", slots: { body: { elements: [deepest] } } },
            ],
          },
        },
      },
    ],
  }).elements;
  const card = panel?.slots?.body?.elements[0];
  expect(card?.slots?.body?.elements[0]?.kind).toBe("card");
  expect(card?.slots?.body?.elements[0]?.slots).toBeUndefined();
});

it("gives slots only to cards and panels", () => {
  const [text] = cleanConcept({
    elements: [{ kind: "text", slots: { body: { elements: [button] } } }],
  }).elements;
  expect(text?.slots).toBeUndefined();
});

it("styles the elements inside slots from the kit, and finds them all", () => {
  const style: ConceptStyle = {
    id: "primary",
    kind: "button",
    look: { background: "#ff0000" },
    name: "Primary",
  };
  const [panel] = cleanConcept({
    elements: [
      {
        kind: "panel",
        slots: { footer: { elements: [{ ...button, styleId: "primary" }] } },
      },
    ],
  }).elements;
  if (!panel) {
    throw new Error("A panel");
  }
  const styled = styleElement(panel, [style]);
  expect(styled.slots?.footer?.elements[0]?.background).toBe("#ff0000");
  expect(everyElement([styled]).map((e) => e.kind)).toEqual([
    "panel",
    "button",
  ]);
});
