import { afterEach, describe, expect, it } from "vitest";
import type { PaletteEntry } from "../../../config/brandKit.js";
import { contrastRatio } from "../../../config/theme.js";
import { guideTheme, readableOn } from "./guideTheme";
import "../../pages/DocShell.css";
import "./BrandGuide.css";

const entry = (role: string, value: string, name = role): PaletteEntry => ({
  name,
  role,
  value,
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("brand guide theme", () => {
  it("honours a dark background and explicit ink instead of sorting their lightness", () => {
    expect(
      guideTheme([
        entry("background", "#182437"),
        entry("text", "#eee5cc"),
        entry("neutral", "#ffffff"),
        entry("neutral", "#000000"),
      ])
    ).toMatchObject({
      "--guide-bg": "#182437",
      "--guide-ink": "#eee5cc",
    });
  });

  it("gives roles priority over names and normalizes compound roles", () => {
    expect(
      guideTheme([
        entry("", "#ffffff", "Background"),
        entry("background", "#182437", "Navy"),
        entry("button-background", "#d9eb63"),
        entry("button_text", "#182437"),
      ])
    ).toMatchObject({
      "--guide-bg": "#182437",
      "--guide-button": "#d9eb63",
      "--guide-button-ink": "#182437",
    });
  });

  it("keeps empty and single-colour kits readable", () => {
    for (const palette of [[], [entry("neutral", "#cccccc")]]) {
      const theme = guideTheme(palette) as Record<string, string>;
      expect(
        contrastRatio(theme["--guide-bg"], theme["--guide-ink"])
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(theme["--guide-button"], theme["--guide-button-ink"])
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableOn("#182437", ["#eee5cc"])).toBe("#eee5cc");
  });

  it("applies kit colours to the actual document and buttons and updates with the kit", () => {
    const root = document.createElement("div");
    root.className = "doc-shell guide";
    const button = document.createElement("button");
    button.className = "doc-shell__action";
    root.append(button);
    document.body.append(root);
    const apply = (palette: PaletteEntry[]) => {
      for (const [key, value] of Object.entries(guideTheme(palette))) {
        root.style.setProperty(key, String(value));
      }
    };
    apply([
      entry("background", "#182437"),
      entry("ink", "#eee5cc"),
      entry("button", "#d9eb63"),
      entry("button text", "#182437"),
    ]);
    expect(getComputedStyle(root).backgroundColor).toBe("rgb(24, 36, 55)");
    expect(getComputedStyle(root).color).toBe("rgb(238, 229, 204)");
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(217, 235, 99)");
    expect(getComputedStyle(button).color).toBe("rgb(24, 36, 55)");
    button.style.transition = "none";
    apply([
      entry("background", "#eee5cc"),
      entry("ink", "#182437"),
      entry("button", "#182437"),
    ]);
    expect(getComputedStyle(root).backgroundColor).toBe("rgb(238, 229, 204)");
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(24, 36, 55)");
  });
});
