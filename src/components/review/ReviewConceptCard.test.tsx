import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { createConceptElement } from "../admin/ReviewConceptBrand";
import { ReviewConceptElementFields } from "../admin/ReviewConceptElementFields";
import "../admin/ReviewConceptsEditor.css";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** A card is edited as a title and a body, and drawn with a border and shadow. */

function CardHarness() {
  const [card, setCard] = useState<ReviewConceptElement>(() =>
    createConceptElement("card")
  );
  return (
    <>
      <ReviewConceptElementFields
        element={card}
        onChange={(patch) => setCard({ ...card, ...patch })}
        onDuplicate={() => undefined}
        onRemove={() => undefined}
      />
      <ReviewConceptElementView element={card} />
    </>
  );
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<CardHarness />));
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const field = (name: string) => {
  const control =
    host?.querySelector(`[aria-label="${name}"]`) ??
    [...(host?.querySelectorAll("label") ?? [])]
      .find((label) => label.querySelector("span")?.textContent === name)
      ?.querySelector("textarea");
  if (
    !(
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement
    )
  ) {
    throw new Error(`No "${name}" field`);
  }
  return control;
};

const card = () => {
  const article = host?.querySelector("article");
  if (!article) {
    throw new Error("No card preview");
  }
  return article;
};

describe("concept card", () => {
  it("shows separate title and body fields", () => {
    expect(field("Card title").value).toBe("Card title");
    expect(field("Card body").value).toBe("Supporting copy goes here.");
  });

  it("draws the title and body as separate parts", async () => {
    await userEvent.clear(field("Card title"));
    await userEvent.type(field("Card title"), "Pricing");
    await userEvent.clear(field("Card body"));
    await userEvent.type(field("Card body"), "Plans for every team.");

    expect(card().querySelector("strong")?.textContent).toBe("Pricing");
    expect(card().querySelector("p")?.textContent).toBe(
      "Plans for every team."
    );
  });

  it("shows the icon picked for it, and none by default", async () => {
    expect(card().querySelector("svg")).toBeNull();
    const picker = host?.querySelector('[aria-label="Card icon"]');
    if (!(picker instanceof HTMLElement)) {
      throw new Error("No card icon picker");
    }
    await userEvent.click(picker);
    const heart = host?.querySelector('[role="option"][title="Favourite"]');
    if (!(heart instanceof HTMLElement)) {
      throw new Error("No Favourite icon in the picker");
    }
    await userEvent.click(heart);
    // The icon map loads in its own chunk, so the drawing lands a tick later.
    await expect.poll(() => card().querySelector("svg")).not.toBeNull();
  });

  it("sizes the title and the body separately", async () => {
    await userEvent.clear(field("Title size"));
    await userEvent.type(field("Title size"), "24");
    await userEvent.clear(field("Body size"));
    await userEvent.type(field("Body size"), "12");

    expect(getComputedStyle(card()).fontSize).toBe("24px");
    const body = card().querySelector("p");
    expect(body && getComputedStyle(body).fontSize).toBe("12px");
  });

  it("has a border and a shadow", () => {
    const style = getComputedStyle(card());
    expect(style.borderTopWidth).toBe("1px");
    expect(style.borderTopStyle).toBe("solid");
    expect(style.boxShadow).not.toBe("none");
  });
});
