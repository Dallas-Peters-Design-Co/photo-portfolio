import { describe, expect, it } from "vitest";
import {
  DEFAULT_PIN_COLORS,
  DEFAULT_THEME,
  inkOn,
  normalizeTheme,
} from "./theme.js";

describe("review note colors", () => {
  it("gives each kind its own color by default", () => {
    const theme = normalizeTheme({}, DEFAULT_THEME.addison);
    expect(theme.pinColors).toEqual(DEFAULT_PIN_COLORS);
    expect(new Set(Object.values(theme.pinColors)).size).toBe(4);
  });

  it("keeps a saved color and drops an invalid one", () => {
    const theme = normalizeTheme(
      { pinColors: { issue: "#123456", praise: "green" } },
      DEFAULT_THEME.addison
    );
    expect(theme.pinColors.issue).toBe("#123456");
    expect(theme.pinColors.praise).toBe(DEFAULT_PIN_COLORS.praise);
  });

  it("draws the number and ring in whichever of black or white reads", () => {
    expect(inkOn("#ffff00")).toBe("#111111");
    expect(inkOn("#1e3a8a")).toBe("#ffffff");
  });
});
