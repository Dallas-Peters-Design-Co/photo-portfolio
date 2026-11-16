import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  cleanConcept,
  type ReviewConcept,
} from "../../../config/reviewConcept.js";
import { ReviewConceptPreview } from "./ReviewConceptPreview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const el = (
  kind: Parameters<typeof createConceptElement>[0],
  over: Record<string, unknown> = {}
) => ({
  ...createConceptElement(kind),
  ...over,
});

/** Click Upload → a toast and the drop area → the file and a field for its description. */
const uploadFlow = (): ReviewConcept => {
  const upload = el("button", { id: "upload-btn", text: "Upload a file" });
  const drop = el("upload", { id: "drop" });
  return cleanConcept({
    elements: [upload],
    stepCaption: "The page before anything happens",
    steps: [
      {
        caption: "Clicks Upload: a toast says what to do",
        elements: [
          el("toast", { id: "t1", text: "Choose a file to upload" }),
          drop,
        ],
        id: "s2",
        trigger: "drop",
      },
      {
        caption: "Picks a file, then describes it",
        elements: [
          el("upload", { id: "done", placeholder: "brand-brief.pdf" }),
          el("input", {
            id: "desc",
            placeholder: "Describe this file",
            text: "",
          }),
          el("button", { id: "save", text: "Save" }),
        ],
        id: "s3",
      },
    ],
    stepTrigger: "upload-btn",
    title: "Upload a file",
  });
};

it("plays a sequence when the viewer clicks each step's trigger in the mock-up", async () => {
  const host = document.createElement("div");
  host.style.width = "640px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(<ReviewConceptPreview concept={uploadFlow()} />)
  );

  expect(host.textContent).toContain("Step 1 of 3");
  await userEvent.click(
    host.querySelector(".concept-canvas button") as HTMLElement
  );
  expect(host.textContent).toContain("Step 2 of 3");
  expect(host.textContent).toContain("Choose a file to upload");

  await userEvent.click(
    host.querySelector(".concept-canvas .concept-upload") as HTMLElement
  );
  expect(host.textContent).toContain("Step 3 of 3");
  expect(host.textContent).toContain("brand-brief.pdf");
  expect(
    host.querySelector('input[placeholder="Describe this file"]')
  ).not.toBeNull();

  // Back, and Start over from the last step.
  await userEvent.click(
    [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "Start over"
    ) as HTMLElement
  );
  expect(host.textContent).toContain("Step 1 of 3");
});

it("drops a trigger that names an element the step doesn't have", () => {
  const concept = cleanConcept({
    elements: [el("button", { id: "a" })],
    steps: [
      { caption: "x", elements: [el("text", { id: "b" })], trigger: "a" },
    ],
    stepTrigger: "missing",
  });
  expect(concept.stepTrigger).toBeUndefined();
  expect(concept.steps?.[0]?.trigger).toBeUndefined();
});
