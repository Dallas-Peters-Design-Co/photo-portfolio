import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import {
  nameFor,
  normalHex,
  recolourItems,
  recolourString,
  varFor,
} from "./colorVars";

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    config: null,
    id: "a",
    kind: "text",
    textStyle: null,
    ...over,
  }) as BoardItem;

describe("colour variables", () => {
  it("reads colours the same however they're written", () => {
    expect(normalHex("#ABC")).toBe("#aabbcc");
    expect(normalHex("#C5CF3A80")).toBe("#c5cf3a80");
    expect(normalHex("red")).toBeNull();
  });

  it("knows a colour's variable, whatever its transparency", () => {
    const vars = [{ id: "1", name: "Lime", value: "#c5cf3a" }];
    expect(varFor("#C5CF3A40", vars)?.name).toBe("Lime");
    expect(varFor("#c5cf3b", vars)).toBeNull();
  });

  it("changes a colour inside lists and gradients, keeping alpha", () => {
    expect(
      recolourString("#c5cf3a,#111111,#C5CF3A80", "#c5cf3a", "#ff0000")
    ).toBe("#ff0000,#111111,#ff000080");
    expect(
      recolourString("linear-gradient(#c5cf3a, #fff)", "#c5cf3a", "#000000")
    ).toBe("linear-gradient(#000000, #fff)");
    // Letter colour sets in a Studio recipe.
    expect(recolourString(",#c5cf3a|#222222", "#c5cf3a", "#00ff00")).toBe(
      ",#00ff00|#222222"
    );
  });

  it("changes every layer that uses the colour, and only those", () => {
    const items = [
      item({
        id: "t",
        textStyle: { color: "#C5CF3A" } as BoardItem["textStyle"],
      }),
      item({
        config: { fill: "#c5cf3a", stroke: "#000000" },
        id: "s",
        kind: "drawing",
      }),
      item({
        config: { component: "c", props: { mark: "#c5cf3a" } },
        id: "i",
        kind: "component",
      }),
      item({
        config: { studio: { values: { colors: "#c5cf3a,#f3e9a3" } } },
        id: "f",
        kind: "reference",
      }),
      item({ config: { fill: "#123456" }, id: "x", kind: "drawing" }),
    ];
    const { changed, items: next } = recolourItems(items, "#c5cf3a", "#8fd6e8");
    expect(changed).toEqual(["t", "s", "i", "f"]);
    expect(next[0]?.textStyle?.color).toBe("#8fd6e8");
    expect(next[1]?.config).toEqual({ fill: "#8fd6e8", stroke: "#000000" });
    expect(next[2]?.config).toEqual({
      component: "c",
      props: { mark: "#8fd6e8" },
    });
    expect(next[4]).toBe(items[4]);
  });

  it("names a new variable without clashing", () => {
    const vars = [{ id: "1", name: "Lime", value: "#c5cf3a" }];
    expect(nameFor("lime", vars)).toBe("lime 2");
    expect(nameFor("  ", vars)).toBe("Colour");
  });
});
