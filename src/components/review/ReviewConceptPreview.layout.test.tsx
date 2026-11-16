import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import { ReviewConceptPreview } from "./ReviewConceptPreview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** The review page's stat-card row: three cards side by side in a narrow column. */
it("keeps cards in a row inside the preview, sharing its width", () => {
  const host = document.createElement("div");
  host.style.width = "500px";
  document.body.append(host);
  // One with a hover look, so the row is checked through its wrapper too.
  const card = (title: string) => ({
    ...createConceptElement("card"),
    hover: { background: "#eeeeee" },
    iconName: "StarIcon",
    text: `2\n${title}`,
  });
  act(() =>
    createRoot(host).render(
      <ReviewConceptPreview
        concept={{
          ...createConcept(),
          direction: "row",
          elements: [
            card("Total Projects"),
            card("In Progress"),
            card("Manuscripts Complete"),
          ],
        }}
      />
    )
  );
  const preview = host.querySelector(
    ".review-page__concept-preview"
  ) as HTMLElement;
  const edge = preview.getBoundingClientRect().right;
  const cards = [...preview.querySelectorAll("article")];
  expect(cards).toHaveLength(3);
  for (const each of cards) {
    expect(each.getBoundingClientRect().right).toBeLessThanOrEqual(edge);
  }
  host.remove();
});

it("wraps cards to a new line rather than squeezing them, all one height", () => {
  const host = document.createElement("div");
  host.style.width = "380px";
  document.body.append(host);
  const card = (title: string) => ({
    ...createConceptElement("card"),
    text: `2\n${title}`,
  });
  act(() =>
    createRoot(host).render(
      <ReviewConceptPreview
        concept={{
          ...createConcept(),
          direction: "row",
          elements: [
            card("Total Projects"),
            card("In Progress"),
            card("Manuscripts Complete and a much longer label"),
            card("Awaiting Review"),
          ],
        }}
      />
    )
  );
  const cards = [...host.querySelectorAll("article")].map((a) =>
    a.getBoundingClientRect()
  );
  // Not squeezed: each at least 10rem wide.
  for (const box of cards) {
    expect(box.width).toBeGreaterThanOrEqual(160);
  }
  // Two lines of two, each line one height.
  expect(cards[0]?.top).toBe(cards[1]?.top);
  expect(cards[2]?.top).toBeGreaterThan(cards[0]?.top ?? 0);
  expect(cards[0]?.height).toBe(cards[1]?.height);
  expect(cards[2]?.height).toBe(cards[3]?.height);
  host.remove();
});

it("keeps a stretched card's content packed at the top", () => {
  const host = document.createElement("div");
  host.style.width = "600px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ReviewConceptPreview
        concept={{
          ...createConcept(),
          direction: "row",
          elements: [
            { ...createConceptElement("card"), text: "2\nShort" },
            {
              ...createConceptElement("card"),
              text: "2\nA much longer label that wraps over several lines here",
            },
          ],
        }}
      />
    )
  );
  const short = host.querySelector("article") as HTMLElement;
  const title = short.querySelector("strong") as HTMLElement;
  const body = short.querySelector("p") as HTMLElement;
  // The body sits right under the title, not pushed down the card.
  const gap =
    body.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
  expect(gap).toBeLessThan(16);
  host.remove();
});

it("makes a row of cards as tall as the tallest card, not the whole preview", () => {
  const host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ReviewConceptPreview
        concept={{
          ...createConcept(),
          direction: "row",
          elements: ["Total Projects", "In Progress"].map((label) => ({
            ...createConceptElement("card"),
            text: `2\n${label}`,
          })),
        }}
      />
    )
  );
  const preview = host.querySelector(
    ".review-page__concept-preview"
  ) as HTMLElement;
  preview.style.minHeight = "600px";
  const card = host.querySelector("article") as HTMLElement;
  // Fits its content (well under the preview's 600px), and both match.
  expect(card.getBoundingClientRect().height).toBeLessThan(200);
  const [a, b] = [...host.querySelectorAll("article")].map(
    (el) => el.getBoundingClientRect().height
  );
  expect(a).toBe(b);
  host.remove();
});
