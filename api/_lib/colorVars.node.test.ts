import { expect, it } from "vitest";
import { parseColorVars } from "./colorVars.js";

it("keeps good colour variables and drops the rest", () => {
  expect(
    parseColorVars([
      { id: "a", name: " Lime ", value: "#C5CF3A" },
      { id: "a", name: "Twice", value: "#000000" },
      { id: "b", name: "Bad", value: "red" },
      { id: "c", value: "#8fd6e8" },
      null,
    ])
  ).toEqual([
    { id: "a", name: "Lime", value: "#c5cf3a" },
    { id: "c", name: "Colour", value: "#8fd6e8" },
  ]);
  expect(parseColorVars("nope")).toBeNull();
});

it("reads every named variable back after a board save", () => {
  const vars = Array.from({ length: 55 }, (_, i) => ({
    id: `color-${i}`,
    name: `Color ${i}`,
    value: "#114477",
  }));
  expect(
    parseColorVars(JSON.parse(JSON.stringify(parseColorVars(vars))))
  ).toEqual(vars);
});
