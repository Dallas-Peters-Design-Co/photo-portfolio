import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
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

it("moves on from any control in the mock-up, and starts over from the last step's", async () => {
  const concept = cleanConcept({
    elements: [
      el("button", { id: "go", text: "Go" }),
      el("button", { id: "other", text: "Other" }),
    ],
    steps: [
      {
        caption: "Done",
        elements: [el("button", { id: "save", text: "Save" })],
        id: "s2",
      },
    ],
    stepTrigger: "go",
    title: "Any control",
  });
  const host = document.createElement("div");
  host.style.width = "640px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(<ReviewConceptPreview concept={concept} />)
  );
  const press = (text: string) =>
    userEvent.click(
      [...host.querySelectorAll(".concept-canvas button")].find(
        (b) => b.textContent === text
      ) as HTMLElement
    );

  expect(host.textContent).toContain("Step 1 of 2");
  // Not the step's trigger, and it still moves on.
  await press("Other");
  expect(host.textContent).toContain("Step 2 of 2");
  // The last step's Save starts it again; no Next or Start over needed.
  await press("Save");
  expect(host.textContent).toContain("Step 1 of 2");
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

it("moves on from a button inside a panel's slot, and animates the next step's toast in", async () => {
  const concept = cleanConcept({
    elements: [
      {
        kind: "panel",
        slots: {
          footer: {
            elements: [
              {
                group: {
                  elements: [{ id: "send", kind: "button", text: "Send" }],
                  layout: "row",
                },
                kind: "group",
              },
            ],
          },
        },
        text: "Share",
      },
    ],
    steps: [
      {
        caption: "Sent",
        elements: [{ id: "done", kind: "toast", text: "Shared with the team" }],
        enter: { animation: "rise", element: "done" },
      },
    ],
    stepTrigger: "send",
  });
  expect(concept.stepTrigger).toBe("send");
  expect(concept.steps?.[0]?.enter).toEqual({
    animation: "rise",
    element: "done",
  });
  const host = document.createElement("div");
  host.style.width = "560px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(<ReviewConceptPreview concept={concept} />)
  );

  const target = host.querySelector('[data-concept-id="send"]') as HTMLElement;
  expect(target.hasAttribute("data-trigger")).toBe(true);
  await userEvent.click(target.querySelector("button") as HTMLElement);
  expect(host.textContent).toContain("Shared with the team");
  const toast = host.querySelector('[data-concept-id="done"]') as HTMLElement;
  expect(toast.dataset.enter).toBe("rise");
  expect(
    getComputedStyle(toast.firstElementChild as Element).animationName
  ).toBe("concept-enter");
});

it("holds a step's entrance until the concept is on screen, then plays it", async () => {
  const concept = cleanConcept({
    elements: [{ id: "toast", kind: "toast", text: "Saved" }],
    stepEnter: { animation: "rise", element: "toast" },
    steps: [{ caption: "Next", elements: [{ kind: "text", text: "Done" }] }],
  });
  const host = document.createElement("div");
  host.innerHTML = '<div style="height: 3000px"></div>';
  const mount = document.createElement("div");
  host.append(mount);
  document.body.append(host);
  window.scrollTo(0, 0);
  act(() =>
    createRoot(mount).render(<ReviewConceptPreview concept={concept} />)
  );
  const child = () =>
    mount.querySelector('[data-concept-id="toast"]')
      ?.firstElementChild as HTMLElement;
  await new Promise((done) => setTimeout(done, 100));
  expect(getComputedStyle(child()).animationPlayState).toContain("paused");

  mount.scrollIntoView();
  await vi.waitFor(() =>
    expect(getComputedStyle(child()).animationPlayState).not.toContain("paused")
  );
  host.remove();
});
