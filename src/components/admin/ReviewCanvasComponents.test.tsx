import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { EMPTY_KIT } from "../../../config/brandKit.js";
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
  const [concepts, setConcepts] = useState<ReviewConcept[]>([]);
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
  vi.spyOn(componentsApi, "list").mockResolvedValue([component]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Harness />));
  await vi.waitFor(() =>
    expect(
      host.querySelector('[aria-label="Insert canvas component"]')
    ).not.toBeNull()
  );
  await userEvent.click(
    host.querySelector('[aria-label="Insert canvas component"]') as HTMLElement
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
  expect(saved[0]?.canvasComponent?.layers[0]?.body).toBe("Canvas title");
  const reopened = cleanConcept(JSON.parse(JSON.stringify(saved[0])));
  expect(reopened.canvasComponent?.layers[0]?.body).toBe("Canvas title");
  await act(async () =>
    root.render(<ReviewConceptPreview concept={reopened} />)
  );
  expect(host.textContent).toContain("Canvas title");
  await act(async () => root.unmount());
  host.remove();
});
