import { describe, expect, it } from "vitest";
import { parseDescription } from "./imageDescribe.js";
import { parseQuery, scoreImage } from "./imageSearch.js";

describe("image search", () => {
  it("reads colours and words out of a query", () => {
    expect(parseQuery("Navy #FFBF00 moody poster 041045 add")).toEqual({
      colours: ["#0b1f4b", "#ffbf00", "#041045"],
      words: ["navy", "moody", "poster", "add"],
    });
  });

  it("ranks by words matched and colours near", () => {
    const q = parseQuery("moody #041045");
    const navyMoody = scoreImage(
      { colors: ["#0a1450"], description: "moody night street", title: null },
      q
    );
    const navyOnly = scoreImage(
      { colors: ["#06134a"], description: "bright beach", title: null },
      q
    );
    const neither = scoreImage(
      { colors: ["#ffe600"], description: "sunny field", title: null },
      q
    );
    expect(navyMoody).toBeGreaterThan(navyOnly);
    expect(navyOnly).toBeGreaterThan(neither);
    expect(neither).toBe(0);
  });

  it("reads the model's description, even wrapped in prose", () => {
    expect(
      parseDescription(
        'Here: {"description": "warm interior, wood", "colors": ["#A0522D", "nope", "#fff"]}'
      )
    ).toEqual({ colors: ["#a0522d"], description: "warm interior, wood" });
    expect(parseDescription("no json here")).toBeNull();
  });
});
