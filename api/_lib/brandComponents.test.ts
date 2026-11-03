import { describe, expect, it } from "vitest";
import { parseDrawingConfig } from "./boardItemConfig.js";
import { cleanComponentLayers } from "./brandComponents.js";
import {
  parseComponentLink,
  parseImageConfig,
  parseTextConfig,
} from "./layerConfig.js";

const C = "0b9f3c1e-6b8a-4e3c-9f55-2c1d4e5f6a7b";

describe("component links on layers", () => {
  it("keeps a well-formed link and what it was last given", () => {
    const link = {
      base: { body: "Vision", color: "#86d4e9", fontSize: 100, junk: 1 },
      c: C,
      i: "inst1",
      l: "tag",
    };
    expect(parseComponentLink(link)).toEqual({
      base: { body: "Vision", color: "#86d4e9", fontSize: 100 },
      c: C,
      i: "inst1",
      l: "tag",
    });
    expect(parseTextConfig({ component: link })?.component).toBeTruthy();
    expect(parseImageConfig({ component: link })?.component).toBeTruthy();
    expect(
      parseDrawingConfig({ component: link, tool: "rect" })?.component
    ).toBeTruthy();
  });

  it("drops a link that isn't one", () => {
    expect(parseComponentLink({ c: "nope", i: "a", l: "b" })).toBeNull();
    expect(parseTextConfig({ component: { c: C } })).toBeNull();
  });
});

describe("component layers", () => {
  it("takes layers with an id and a kind it knows", () => {
    expect(
      cleanComponentLayers([{ kind: "text", lid: "a", x: 0, y: 0 }])
    ).toHaveLength(1);
    expect(cleanComponentLayers([{ kind: "op", lid: "a" }])).toBeNull();
    expect(cleanComponentLayers([{ kind: "text" }])).toBeNull();
    expect(cleanComponentLayers([])).toBeNull();
    expect(
      cleanComponentLayers([{ kind: "text", lid: "a", x: Number.NaN }])
    ).toBeNull();
  });
});
