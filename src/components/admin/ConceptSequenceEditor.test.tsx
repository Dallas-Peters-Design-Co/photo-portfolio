import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import { cleanConcept } from "../../../config/reviewConcept.js";
import { ConfirmProvider } from "./ConfirmProvider";
import { ReviewConceptsEditor } from "./ReviewConceptsEditor";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("plays the sequence in the editor's preview: clicking the target opens the next step", async () => {
  const concept = cleanConcept({
    elements: [{ id: "go", kind: "button", text: "Upload" }],
    steps: [
      {
        caption: "Toast",
        elements: [{ id: "t", kind: "toast", text: "Pick a file" }],
      },
    ],
    stepTrigger: "go",
  });
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ConfirmProvider>
        <ReviewConceptsEditor concepts={[concept]} onChange={() => undefined} />
      </ConfirmProvider>
    )
  );
  const preview = host.querySelector(
    ".review-concepts__preview"
  ) as HTMLElement;
  // The preview edits by default; Play makes it click through.
  const play = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Play"
  ) as HTMLElement;
  await userEvent.click(play);
  await vi.waitFor(() =>
    expect(play.getAttribute("aria-pressed")).toBe("true")
  );
  await userEvent.click(
    preview.querySelector('[data-concept-id="go"] button') as HTMLElement
  );
  await vi.waitFor(() => expect(preview.textContent).toContain("Pick a file"));
  const selected = host.querySelector(
    '.concept-steps__tab[aria-selected="true"]'
  );
  expect(selected?.textContent).toBe("2");
});

it("in Edit mode, clicking the panel's close button in the preview opens its settings", async () => {
  localStorage.clear();
  const concept = cleanConcept({ elements: [createConceptElement("panel")] });
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ConfirmProvider>
        <ReviewConceptsEditor concepts={[concept]} onChange={() => undefined} />
      </ConfirmProvider>
    )
  );
  const close = host.querySelector(
    ".review-concepts__preview .concept-panel__hide button"
  ) as HTMLElement;
  await userEvent.click(close);
  // Selected, not hidden: the panel is still there.
  expect(
    host.querySelector(".review-concepts__preview .concept-panel__hide")
  ).not.toBeNull();
  const picked = host.querySelector(
    ".review-concepts__element[data-picked]"
  ) as HTMLElement;
  expect(picked).not.toBeNull();
  const toggle = picked.querySelector(
    ".review-concepts__element-toggle"
  ) as HTMLElement;
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(picked.textContent).toContain("Icon");
});
