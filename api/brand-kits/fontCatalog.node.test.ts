import { describe, expect, it } from "vitest";
import { trimAdobeKit, trimGoogleCatalog } from "../_lib/fontCatalog.js";

describe("font catalog", () => {
  it("trims Google metadata to what a picker needs, most popular first", () => {
    const fonts = trimGoogleCatalog({
      familyMetadataList: [
        {
          category: "Display",
          family: "Bebas Neue",
          fonts: { "400": {} },
          popularity: 40,
        },
        {
          axes: [{ tag: "wght" }],
          category: "Sans Serif",
          family: "Inter",
          fonts: { "100": {}, "400": {}, "400i": {}, "900": {} },
          popularity: 1,
        },
      ],
    });
    expect(fonts.map((f) => f.family)).toEqual(["Inter", "Bebas Neue"]);
    expect(fonts[0]).toMatchObject({
      category: "sans",
      italic: true,
      variable: true,
      weights: [100, 400, 900],
    });
    expect(fonts[1]).toMatchObject({
      category: "display",
      italic: false,
      weights: [400],
    });
  });

  it("reads an Adobe Fonts project's families", () => {
    expect(
      trimAdobeKit({
        kit: {
          families: [
            {
              css_names: ["proxima-nova"],
              name: "Proxima Nova",
              variations: ["n4", "i4", "n7"],
            },
          ],
        },
      })
    ).toEqual([
      { family: "proxima-nova", label: "Proxima Nova", weights: [400, 700] },
    ]);
  });
});
