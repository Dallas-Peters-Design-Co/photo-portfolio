import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import { cleanElement } from "../../../config/reviewConcept.js";
import { ConfirmProvider } from "./ConfirmProvider";
import { KitStyleSyncContext } from "./kitStyleSync";
import { ReviewConceptElementFields } from "./ReviewConceptElementFields";

const source = {
  ...createConceptElement("button"),
  background: "#184033",
  paddingX: 84,
  text: "Source action",
};
const target = { ...createConceptElement("tag"), text: "Target label" };
function Harness({
  save,
}: {
  save: (style: ConceptStyle) => Promise<boolean>;
}) {
  const [element, set] = useState(target);
  return (
    <ConfirmProvider>
      <KitStyleSyncContext.Provider value={{ kitName: "Pretext", save }}>
        <section aria-label="Source">
          <ReviewConceptElementFields
            depth={1}
            element={source}
            onChange={() => undefined}
          />
        </section>
        <section aria-label="Destination">
          <ReviewConceptElementFields
            depth={1}
            element={element}
            onChange={(patch) => set(cleanElement({ ...element, ...patch }))}
            onLink={(style) => set({ ...element, styleId: style?.id })}
            styles={[]}
          />
          <output>
            {element.text} · {element.background} · {element.styleId}
          </output>
        </section>
      </KitStyleSyncContext.Provider>
    </ConfirmProvider>
  );
}
it("pastes between kinds, keeps content and saves the result as a named kit variant", async () => {
  const save = vi.fn(async (_style: ConceptStyle) => true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() => root.render(<Harness save={save} />));
    expect(
      host.querySelectorAll('button[aria-expanded="false"][aria-controls]')
    ).toHaveLength(2);
    expect(
      host.querySelectorAll(".review-concepts__element-body")
    ).toHaveLength(0);
    await page
      .getByRole("region", { exact: true, name: "Source" })
      .getByRole("button", { name: "Copy style" })
      .click();
    await page
      .getByRole("region", { name: "Destination" })
      .getByRole("button", { name: "Paste style" })
      .click();
    expect(host.querySelector("output")?.textContent).toContain(
      "Target label · #184033"
    );
    await page.getByRole("button", { name: "Save as kit style" }).click();
    await page.getByPlaceholder("e.g. Secondary").fill("Forest");
    await page.getByRole("button", { name: "Add to kit" }).click();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0]?.[0];
    expect(saved).toMatchObject({
      kind: "tag",
      look: { background: "#184033", paddingX: 84 },
      name: "Forest",
    });
    expect(host.querySelector("output")?.textContent).toContain(saved?.id);
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
