import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
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
  await userEvent.click(
    preview.querySelector('[data-concept-id="go"] button') as HTMLElement
  );
  expect(preview.textContent).toContain("Pick a file");
  const selected = host.querySelector(
    '.concept-steps__tab[aria-selected="true"]'
  );
  expect(selected?.textContent).toBe("2");
});
