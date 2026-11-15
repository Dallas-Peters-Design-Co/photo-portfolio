import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import {
  createConcept,
  createConceptElement,
} from "../admin/ReviewConceptBrand";
import { ReviewConceptPreview } from "./ReviewConceptPreview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** The review page's stat-card row: three cards side by side in a narrow column. */
it("keeps cards in a row inside the preview, sharing its width", () => {
  const host = document.createElement("div");
  host.style.width = "500px";
  document.body.append(host);
  const card = (title: string) => ({
    ...createConceptElement("card"),
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
