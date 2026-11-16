import { describe, expect, it } from "vitest";
import {
  type FontRef,
  fontRefId,
  fontRefStack,
  googleFontCss,
  parseFontRef,
} from "./fontRef";
import { normalizeTextStyle, textStyleCss } from "./textStyle";

describe("font refs", () => {
  it("round-trips Google and Adobe refs", () => {
    const g = {
      family: "Playfair Display",
      kitId: null,
      source: "google",
    } as const;
    const a = {
      family: "proxima-nova",
      kitId: "abc1def",
      source: "adobe",
    } as const;
    expect(parseFontRef(fontRefId(g))).toEqual(g);
    expect(parseFontRef(fontRefId(a))).toEqual(a);
  });

  it("names the app's own fonts, such as Exposure, by id", () => {
    expect(parseFontRef("p:exposure")).toEqual({
      family: "Exposure[0]",
      fontId: "exposure",
      kitId: null,
      source: "app",
    });
    expect(
      fontRefId({ family: "", fontId: "exposure", kitId: null, source: "app" })
    ).toBe("p:exposure");
    expect(fontRefStack(parseFontRef("p:exposure") as FontRef)).toContain(
      '"Exposure[0]"'
    );
    // Only a font the app has.
    expect(parseFontRef("p:not-a-font")).toBeNull();
  });

  it("refuses anything that could break out of CSS or a URL", () => {
    expect(parseFontRef('g:Evil"; }')).toBeNull();
    expect(parseFontRef("a:../x:font")).toBeNull();
    expect(parseFontRef("inter")).toBeNull();
  });

  it("asks Google for every cut so static faces load too", () => {
    expect(googleFontCss("Bebas Neue")).toContain("family=Bebas+Neue:100,100i");
  });

  it("lets text be set in a brand font", () => {
    const style = normalizeTextStyle({
      family: "g:Playfair Display",
      weight: 850,
    });
    expect(style).toMatchObject({ family: "g:Playfair Display", weight: 900 });
    expect(
      textStyleCss({ fontSize: 40, kind: "text", textStyle: style }).fontFamily
    ).toContain('"Playfair Display"');
    expect(normalizeTextStyle({ family: "g:" })).toBeNull();
  });
});
