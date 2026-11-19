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
import "../admin/ReviewConceptsEditor.css";
import { ReviewConceptElementView } from "./ReviewConceptElementView";
import { ReviewConceptPreview } from "./ReviewConceptPreview";

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
  host.style.width = "240px";
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<List />));
  const button = (text: string) =>
    [...host.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === text
    ) as HTMLElement;

  await userEvent.click(button("Group"));
  expect(latest.map((e) => e.kind)).toEqual(["group", "button"]);
  await userEvent.click(button("Into group above"));
  expect(latest).toHaveLength(1);
  expect(latest[0]?.group?.elements.map((e) => e.id)).toEqual(["a", "b"]);
  await userEvent.click(button("Ungroup"));
  expect(latest.map((e) => e.id)).toEqual(["a", "b"]);
  act(() => root.unmount());
  host.remove();
});

it("moves an element into the nearest group above even with items between them", async () => {
  const initial = [
    { ...createConceptElement("group"), id: "first" },
    { ...createConceptElement("text"), id: "middle" },
    { ...createConceptElement("group"), id: "nearest" },
    { ...createConceptElement("text"), id: "between" },
    { ...createConceptElement("button"), id: "target" },
  ];
  let current = initial;
  function Harness() {
    const [elements, setElements] = useState(initial);
    current = elements;
    return (
      <ConceptElementList
        elements={elements}
        label="Elements"
        onChange={setElements}
      />
    );
  }
  const host = document.createElement("div");
  host.style.width = "240px";
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Harness />));
  const target = [...host.querySelectorAll(".review-concepts__sortable")].find(
    (node) => node.querySelector('[aria-label="Remove button"]')
  );
  const move = [...(target?.querySelectorAll("button") ?? [])].find(
    (button) => button.getAttribute("aria-label") === "Into group above"
  );
  expect(move).toBeDefined();
  const footer = target
    ?.querySelector(".review-concepts__element-footer")
    ?.getBoundingClientRect();
  const buttonBox = move?.getBoundingClientRect();
  expect(buttonBox?.right).toBeLessThanOrEqual((footer?.right ?? 0) + 1);
  await userEvent.click(move as HTMLElement);
  expect(current.map((element) => element.id)).toEqual([
    "first",
    "middle",
    "nearest",
    "between",
  ]);
  expect(current[2]?.group?.elements.map((element) => element.id)).toEqual([
    "target",
  ]);
  expect(
    cleanConcept({ elements: current }).elements[2]?.group?.elements[0]?.id
  ).toBe("target");
  await act(async () => root.unmount());
  host.remove();
});

it("does not move an element into a full group", () => {
  const group = createConceptElement("group");
  const full = {
    ...group,
    group: {
      ...group.group,
      elements: Array.from({ length: 24 }, (_, index) => ({
        ...createConceptElement("text"),
        id: `child-${index}`,
      })),
    },
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <ConceptElementList
        elements={[full, createConceptElement("button")]}
        label="Elements"
        onChange={() => undefined}
      />
    )
  );
  const move = [...host.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === "Into group above"
  );
  expect(move?.disabled).toBe(true);
  expect(move?.title).toBe("This group is full");
  act(() => root.unmount());
  host.remove();
});

it("prevents a move that would discard nested group contents on save", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <ConceptElementList
        depth={3}
        elements={[
          createConceptElement("group"),
          createConceptElement("group"),
        ]}
        label="Elements"
        onChange={() => undefined}
      />
    )
  );
  const move = [...host.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === "Into group above"
  );
  expect(move?.disabled).toBe(true);
  expect(move?.title).toContain("too deeply nested");
  act(() => root.unmount());
  host.remove();
});

it("spans a full-width group across its row, its items aligned and pushed apart", () => {
  const concept = cleanConcept({
    elements: [
      {
        group: {
          align: "center",
          elements: [
            { fontSize: 13, kind: "text", text: "Selected 0/12" },
            { kind: "button", paddingX: 16, paddingY: 12, text: "Select All" },
          ],
          // Saved as the old "Fill the width": read as Full width.
          fill: true,
          justify: "between",
          layout: "row",
        },
        kind: "group",
      },
    ],
  });
  expect(concept.elements[0]?.group?.full).toBe(true);
  expect(concept.elements[0]?.group?.fill).toBeUndefined();
  const host = document.createElement("div");
  host.style.width = "700px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(<ReviewConceptPreview concept={concept} />)
  );
  const [text, button] = [
    ...host.querySelectorAll(".concept-group__items > *"),
  ].map((el) => el.getBoundingClientRect());
  const group = (
    host.querySelector(".concept-group") as HTMLElement
  ).getBoundingClientRect();
  // Each keeps its own width, at the two ends, centred on one line.
  expect(Math.round((text as DOMRect).left)).toBe(Math.round(group.left));
  expect(Math.round((button as DOMRect).right)).toBe(Math.round(group.right));
  expect((text as DOMRect).width).toBeLessThan(group.width / 2);
  const mid = (r: DOMRect) => r.top + r.height / 2;
  expect(Math.abs(mid(text as DOMRect) - mid(button as DOMRect))).toBeLessThan(
    1
  );
});

it("keeps the toggle beside the panel when its body contains a card", () => {
  const panel = {
    ...createConceptElement("panel"),
    slots: {
      body: {
        elements: [{ ...createConceptElement("card"), text: "Table 1\nBody" }],
      },
      header: { elements: [] },
      hide: createConceptElement("panel").slots?.hide,
    },
    text: "Results",
  } as ReviewConceptElement;
  const host = document.createElement("div");
  host.style.width = "600px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(<ReviewConceptElementView element={panel} />)
  );
  const inner = host.querySelector(".concept-panel__inner") as HTMLElement;
  const handle = host.querySelector(".concept-panel__hide") as HTMLElement;
  expect(
    inner.querySelectorAll('.concept-slot[data-slot="header"]')
  ).toHaveLength(2);
  expect(inner.getBoundingClientRect().right).toBeLessThanOrEqual(
    handle.getBoundingClientRect().left
  );
  host.remove();
});
