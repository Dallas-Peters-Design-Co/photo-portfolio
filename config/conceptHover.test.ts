import { describe, expect, it } from "vitest";
import { cleanHover } from "./conceptHover.js";
import { cleanConcept } from "./reviewConcept.js";

describe("hover", () => {
  it("keeps colours and a shadow, and drops anything else", () => {
    expect(
      cleanHover({
        background: "#ff0000",
        borderColor: "red",
        color: "#ffffff",
      })
    ).toEqual({ background: "#ff0000", color: "#ffffff" });
    expect(cleanHover({ background: "nope" })).toBeUndefined();
  });

  it("is kept on things a reader points at, not on text or dividers", () => {
    const hover = { background: "#ff0000" };
    const [button, card, text, divider] = cleanConcept({
      elements: ["button", "card", "text", "divider"].map((kind) => ({
        hover,
        kind,
      })),
    }).elements;
    expect(button?.hover).toEqual(hover);
    expect(card?.hover).toEqual(hover);
    expect(text?.hover).toBeUndefined();
    expect(divider?.hover).toBeUndefined();
  });
});

it("keeps a hover icon colour", () => {
  expect(cleanHover({ iconColor: "#ff0000" })).toEqual({
    iconColor: "#ff0000",
  });
});
