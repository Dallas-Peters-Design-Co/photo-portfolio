import { describe, expect, it } from "vitest";
import {
  cleanConcept,
  conceptIconName,
  joinCardText,
  splitCardText,
} from "./reviewConcept.js";

describe("card text", () => {
  it("splits the first line into the title and keeps the rest as the body", () => {
    expect(splitCardText("Card title\nLine one\nLine two")).toEqual({
      body: "Line one\nLine two",
      title: "Card title",
    });
  });

  it("reads a single line as a title with no body", () => {
    expect(splitCardText("Only a title")).toEqual({
      body: "",
      title: "Only a title",
    });
  });

  it("round-trips a title and a body", () => {
    const text = joinCardText("Title", "Body\nMore");
    expect(splitCardText(text)).toEqual({ body: "Body\nMore", title: "Title" });
  });

  it("keeps a pasted newline in the title from moving text into the body", () => {
    expect(joinCardText("Two\nlines", "Body")).toBe("Two lines\nBody");
  });
});

describe("card border and shadow", () => {
  it("keeps a valid border color and shadow on a card", () => {
    const [card] = cleanConcept({
      elements: [{ borderColor: "#e8e4dc", kind: "card", shadow: "strong" }],
    }).elements;
    expect(card).toMatchObject({ borderColor: "#e8e4dc", shadow: "strong" });
  });

  it("drops a bad border color and shadow, and ignores them on other kinds", () => {
    const [card, button] = cleanConcept({
      elements: [
        { borderColor: "red", kind: "card", shadow: "huge" },
        { borderColor: "#ffffff", kind: "button", shadow: "soft" },
      ],
    }).elements;
    expect(card?.borderColor).toBeUndefined();
    expect(card?.shadow).toBeUndefined();
    expect(button?.borderColor).toBeUndefined();
    expect(button?.shadow).toBeUndefined();
  });
});

describe("concept icons", () => {
  it("reads an old Lucide name as its Hugeicons match", () => {
    expect(conceptIconName("heart")).toBe("FavouriteIcon");
    expect(conceptIconName("shopping-bag")).toBe("ShoppingBag01Icon");
  });

  it("keeps a Hugeicons name and rejects anything else", () => {
    expect(conceptIconName("Camera01Icon")).toBe("Camera01Icon");
    expect(conceptIconName("<script>")).toBeNull();
    expect(conceptIconName(42)).toBeNull();
  });

  it("migrates a saved icon and gives an icon element a star by default", () => {
    const [icon, card, broken] = cleanConcept({
      elements: [
        { iconName: "bell", kind: "icon" },
        { iconName: "nope", kind: "card" },
        { iconName: "nope", kind: "icon" },
      ],
    }).elements;
    expect(icon?.iconName).toBe("Notification01Icon");
    expect(card?.iconName).toBeUndefined();
    expect(broken?.iconName).toBe("StarIcon");
  });
});
