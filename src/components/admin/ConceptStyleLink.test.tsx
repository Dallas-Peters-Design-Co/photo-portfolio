import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import {
  cleanConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { StyleLink } from "./ConceptStyleLink";
import { ConfirmProvider } from "./ConfirmProvider";
import { KitStyleSyncContext } from "./kitStyleSync";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const primary: ConceptStyle = {
  id: "primary",
  kind: "button",
  look: { background: "#ff0000", color: "#ffffff" },
  name: "Primary",
};

it("pushes an element's own changes back to its kit style", async () => {
  const element = {
    ...(cleanConcept({ elements: [{ kind: "button", text: "Go" }] })
      .elements[0] as ReviewConceptElement),
    background: "#0000ff",
    overrides: ["background"],
    styleId: "primary",
  } as ReviewConceptElement;
  const save = vi.fn(async (_style: ConceptStyle) => true);
  const onLink = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ConfirmProvider>
        <KitStyleSyncContext.Provider value={{ kitName: "Pretext", save }}>
          <StyleLink element={element} onLink={onLink} styles={[primary]} />
        </KitStyleSyncContext.Provider>
      </ConfirmProvider>
    )
  );
  const update = [...host.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === "Update kit style"
  );
  expect(update).toBeDefined();
  await userEvent.click(update as HTMLElement);
  await vi.waitFor(() => expect(onLink).toHaveBeenCalled());
  const saved = save.mock.calls[0]?.[0] as ConceptStyle;
  expect(saved.id).toBe("primary");
  expect(saved.look.background).toBe("#0000ff");
  expect(onLink).toHaveBeenCalledWith(saved);
});
