import { describe, expect, it } from "vitest";
import {
  logosWithScan,
  nameOfVariable,
  paletteWithScan,
  scannedLogoLabel,
} from "./scanTheme";

describe("scanned colours into the palette", () => {
  it("names a colour from its variable, or from what the site uses it for", () => {
    expect(nameOfVariable("--color-brand-primary")).toBe("Brand primary");
    expect(nameOfVariable("--token-6f08dd7e-87b0-4c61")).toBeNull();
    expect(nameOfVariable("--c-3a70b3ff")).toBeNull();
  });

  it("adds new colours after the kit's own, each once, in order of use", () => {
    const palette = [{ name: "Ink", role: "text", value: "#0b1112" }];
    const out = paletteWithScan(palette, [
      {
        name: "--token-6f08dd7e-87b0",
        role: "text",
        uses: 90,
        value: "#0B1112",
      },
      {
        name: "--token-3e4f945f-fbde",
        role: "background",
        uses: 40,
        value: "#fefefe",
      },
      {
        name: "--token-49863225-ad34",
        role: "background",
        uses: 20,
        value: "#04242b",
      },
      { name: "--brand-accent", role: "accent", uses: 9, value: "#2a84f8" },
    ]);
    expect(out.map((p) => [p.name, p.value])).toEqual([
      ["Ink", "#0b1112"],
      ["Background", "#fefefe"],
      ["Background 2", "#04242b"],
      ["Brand accent", "#2a84f8"],
    ]);
  });
});

describe("the scanned logo", () => {
  it("is added once per site, found again on a rescan by its label", () => {
    const label = scannedLogoLabel("https://www.rolemodelsoftware.com/ai");
    expect(label).toBe("rolemodelsoftware.com logo");
    const once = logosWithScan([], label, "https://blob/a.svg");
    expect(once).toHaveLength(1);
    expect(logosWithScan(once, label, "https://blob/b.svg")).toBe(once);
  });
});
