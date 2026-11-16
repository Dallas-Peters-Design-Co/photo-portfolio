import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { componentSource } from "../../../config/componentSource.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  cleanConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { ConceptElementList } from "../admin/ConceptElementList";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("lays a group's elements out in a row inside a panel's slot", () => {
  const panel = cleanConcept({
    elements: [
      {
        kind: "panel",
        slots: {
          footer: {
            elements: [
              {
                group: {
                  elements: [
                    { kind: "button", text: "Cancel" },
                    { kind: "button", text: "Save" },
                  ],
                  gap: 12,
                  justify: "end",
                  layout: "row",
                },
                kind: "group",
              },
            ],
          },
        },
        text: "Edit",
      },
    ],
  }).elements[0] as ReviewConceptElement;
  const host = document.createElement("div");
  host.style.width = "480px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(<ReviewConceptElementView element={panel} />)
  );
  const [cancel, save] = [
    ...host.querySelectorAll(".concept-group button"),
  ] as HTMLElement[];
  expect(cancel && save).toBeTruthy();
  const a = (cancel as HTMLElement).getBoundingClientRect();
  const b = (save as HTMLElement).getBoundingClientRect();
  // Side by side, 12px apart, in one row.
  expect(Math.abs(a.top - b.top)).toBeLessThan(1);
  expect(Math.round(b.left - a.right)).toBe(12);

  const source = componentSource(panel, "Edit");
  expect(source.tsx).toContain('data-layout="row"');
});

let latest: ReviewConceptElement[] = [];
function List() {
  const [elements, setElements] = useState<ReviewConceptElement[]>([
    { ...createConceptElement("button"), id: "a", text: "One" },
    { ...createConceptElement("button"), id: "b", text: "Two" },
  ]);
  latest = elements;
  return (
    <ConceptElementList
      elements={elements}
      label="Elements"
      onChange={setElements}
    />
  );
}

it("groups an element, moves the next into the group, and ungroups", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<List />));
  const button = (text: string) =>
    [...host.querySelectorAll("button")].find(
      (b) => b.textContent === text
    ) as HTMLElement;

  await userEvent.click(button("Group"));
  expect(latest.map((e) => e.kind)).toEqual(["group", "button"]);
  await userEvent.click(button("Into group above"));
  expect(latest).toHaveLength(1);
  expect(latest[0]?.group?.elements.map((e) => e.id)).toEqual(["a", "b"]);
  await userEvent.click(button("Ungroup"));
  expect(latest.map((e) => e.id)).toEqual(["a", "b"]);
});
