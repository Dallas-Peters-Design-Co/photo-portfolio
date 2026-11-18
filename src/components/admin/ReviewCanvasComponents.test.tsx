import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import {
  cleanConcept,
  type ReviewConcept,
} from "../../../config/reviewConcept.js";
import { componentsApi } from "../../boards/creative/components/componentsApi";
import { ReviewConceptPreview } from "../review/ReviewConceptPreview";
import { KitStyleSyncContext } from "./kitStyleSync";
import { ReviewConceptsEditor } from "./ReviewConceptsEditor";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const component = {
  height: 100,
  id: "component-1",
  kitId: "kit-1",
  layers: [
    {
      body: "Canvas title",
      config: null,
      fontSize: 24,
      height: 80,
      imageUrl: null,
      kind: "text" as const,
      lid: "layer-1",
      thumbUrl: null,
      width: 300,
      x: 0,
      y: 0,
    },
  ],
  name: "Canvas header",
  placement: {},
  props: [],
  updatedAt: "",
  width: 400,
};
let saved: ReviewConcept[] = [];
function Harness() {
  const [concepts, setConcepts] = useState<ReviewConcept[]>([
    {
      ...createConcept(),
      direction: "row",
      elements: [{ ...createConceptElement("text"), text: "Existing text" }],
    },
  ]);
  saved = concepts;
  return (
    <KitStyleSyncContext.Provider
      value={{ kitId: "kit-1", kitName: "Kit", save: async () => true }}
    >
      <ReviewConceptsEditor
        brandDoc={EMPTY_KIT}
        concepts={concepts}
        onChange={setConcepts}
      />
    </KitStyleSyncContext.Provider>
  );
}
afterEach(() => {
  vi.restoreAllMocks();
});
it("inserts a canvas component and retains its layers in a saved review preview", async () => {
  await page.viewport(1200, 900);
  vi.spyOn(componentsApi, "list").mockResolvedValue([component]);
  const host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Harness />));
  await vi.waitFor(() => expect(componentsApi.list).toHaveBeenCalled());
  await userEvent.click(
    host.querySelector('[aria-label="Add a component"]') as HTMLElement
  );
  const choice = await vi.waitFor(() => {
    const found = [...document.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent === "Canvas header"
    );
    if (!found) {
      throw new Error("Component option missing");
    }
    return found as HTMLElement;
  });
  await userEvent.click(choice);
  expect(saved).toHaveLength(1);
  expect(saved[0]?.elements.map((item) => item.kind)).toEqual([
    "text",
    "canvas",
  ]);
  expect(saved[0]?.elements[1]?.canvasComponent?.layers[0]?.body).toBe(
    "Canvas title"
  );
  const reopened = cleanConcept(JSON.parse(JSON.stringify(saved[0])));
  expect(reopened.elements[1]?.canvasComponent?.layers[0]?.body).toBe(
    "Canvas title"
  );
  await act(async () =>
    root.render(<ReviewConceptPreview concept={reopened} />)
  );
  expect(host.textContent).toContain("Canvas title");
  expect(host.textContent).toContain("Existing text");
  const existing = [...host.querySelectorAll<HTMLElement>("span, p, div")].find(
    (element) => element.textContent === "Existing text"
  );
  const canvas = host.querySelector<HTMLElement>(".review-canvas-component");
  expect(canvas?.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    existing?.getBoundingClientRect().right ?? Number.POSITIVE_INFINITY
  );
  expect(canvas?.getBoundingClientRect().top).toBeCloseTo(
    existing?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
    0
  );
  await act(async () => root.unmount());
  host.remove();
});

it("keeps canvas components inside groups and migrates previously saved standalone components", () => {
  const canvas = {
    ...createConceptElement("canvas"),
    canvasComponent: component,
  };
  const group = createConceptElement("group");
  const concept = createConcept();
  const reopened = cleanConcept({
    ...concept,
    elements: [
      {
        ...group,
        group: {
          ...group.group,
          elements: [createConceptElement("text"), canvas],
        },
      },
    ],
  });
  expect(
    reopened.elements[0]?.group?.elements.map((element) => element.kind)
  ).toEqual(["text", "canvas"]);
  expect(reopened.elements[0]?.group?.elements[1]?.canvasComponent?.name).toBe(
    "Canvas header"
  );
  const migrated = cleanConcept({ ...concept, canvasComponent: component });
  expect(migrated.elements[0]?.canvasComponent?.name).toBe("Canvas header");
  expect(cleanConcept(migrated)).toEqual(migrated);
});
