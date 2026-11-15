import { describe, expect, it } from "vitest";
import {
  addConceptElement,
  createConceptElement,
  duplicateConceptElement,
} from "./ReviewConceptBrand";

/** Several elements of one kind share a look without styling each one. */

describe("adding elements", () => {
  it("gives a new element the style of the last one of its kind", () => {
    const styled = {
      ...createConceptElement("button"),
      background: "#ff0000",
      fontSize: 20,
      radius: 0,
      text: "Buy now",
    };
    const text = createConceptElement("text");
    const [, , added] = addConceptElement([styled, text], "button");

    expect(added).toMatchObject({
      background: "#ff0000",
      fontSize: 20,
      kind: "button",
      radius: 0,
      text: "Get started",
    });
    expect(added?.id).not.toBe(styled.id);
  });

  it("uses the default style for the first element of a kind", () => {
    const [added] = addConceptElement([], "badge");
    expect(added).toMatchObject({ kind: "badge", text: "New" });
  });

  it("drops the default brand font when the model uses a plain one", () => {
    const plain = {
      ...createConceptElement("text"),
      fontFamily: "serif" as const,
    };
    const [, added] = addConceptElement([plain], "text", {
      palette: [],
      typefaces: [{ ref: "g:Inter", role: "headline" }],
    } as never);
    expect(added?.fontFamily).toBe("serif");
    expect(added?.fontRef).toBeUndefined();
  });
});

describe("duplicating an element", () => {
  it("puts an exact copy with a new id right after the original", () => {
    const first = createConceptElement("card");
    const second = createConceptElement("button");
    const elements = duplicateConceptElement([first, second], first.id);

    expect(elements.map((element) => element.kind)).toEqual([
      "card",
      "card",
      "button",
    ]);
    expect({ ...elements[1], id: first.id }).toEqual(first);
    expect(elements[1]?.id).not.toBe(first.id);
  });
});

describe("a new badge", () => {
  it("starts as a tinted pill with a fill, text color and thin border", () => {
    const badge = createConceptElement("badge");
    expect(badge.background).not.toBe("transparent");
    expect(badge.borderColor).toBeTruthy();
    expect(badge.borderWidth).toBe(1);
  });
});
