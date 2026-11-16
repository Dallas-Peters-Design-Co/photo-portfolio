import { expect, it } from "vitest";
import { lineHeightFrom } from "./conceptValues.js";

it("keeps a line height typed as a multiple", () => {
  expect(lineHeightFrom(1.2, 14)).toBe(1.2);
  expect(lineHeightFrom(0.5, 14)).toBe(1);
});

it("turns a line height typed in pixels into the multiple", () => {
  // 21px at 14px type is 1.5, not the largest multiple.
  expect(lineHeightFrom(21, 14)).toBe(1.5);
  expect(lineHeightFrom(24, 14)).toBe(1.7);
  // More pixels than the largest multiple gives is still the largest.
  expect(lineHeightFrom(80, 14)).toBe(2.4);
});
