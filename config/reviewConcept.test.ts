import { describe, expect, it } from "vitest";
import { joinCardText, splitCardText } from "./reviewConcept.js";

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
