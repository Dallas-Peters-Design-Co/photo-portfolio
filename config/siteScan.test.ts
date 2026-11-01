import { describe, expect, it } from "vitest";
import {
  colorRef,
  roundedScale,
  sanitizeScans,
  sanitizeWebsites,
  spacingScale,
} from "./siteScan.js";

describe("siteScan", () => {
  it("keeps only http(s) websites, once each", () => {
    expect(
      sanitizeWebsites(["https://a.com", "https://a.com", "ftp://x", "b.com"])
    ).toEqual(["https://a.com"]);
  });

  it("keeps font stacks but drops values that could break YAML or HTML", () => {
    const [scan] = sanitizeScans([
      {
        components: [
          {
            count: 2,
            name: "button-primary",
            sample: "Buy",
            style: {
              backgroundColor: "#c63b2e",
              fontFamily: '"Unruly Sans", Arial',
              padding: "x}{ y",
              textColor: "<script>",
            },
          },
        ],
        rounded: ["4px", "1em", "huge"],
        spacing: ["8px"],
        url: "https://unrulychain.com/",
      },
      { url: "javascript:alert(1)" },
    ]);
    expect(scan?.components[0]?.style).toEqual({
      backgroundColor: "#c63b2e",
      fontFamily: '"Unruly Sans", Arial',
    });
    expect(scan?.rounded).toEqual(["4px", "1em"]);
  });

  it("points a scanned colour at the palette when it's (nearly) the same", () => {
    const palette = [{ token: "primary", value: "#c63b2e" }];
    expect(colorRef("#c13e2e", palette)).toBe("{colors.primary}");
    expect(colorRef("#1a2024", palette)).toBe("#1a2024");
  });

  it("names the radius and spacing scales", () => {
    expect(roundedScale(["8px", "4px", "9999px"])).toEqual([
      ["sm", "4px"],
      ["md", "8px"],
      ["full", "9999px"],
    ]);
    expect(spacingScale(["16px", "8px", "16px"])).toEqual([
      ["xs", "8px"],
      ["sm", "16px"],
    ]);
  });
});
