import { describe, expect, it } from "vitest";
import type { TextStyle } from "../../../config/textStyle";
import type { BoardItem } from "../../types";
import { sharedPatch } from "./sharedPatch";

const text = (id: string, color: string, family: string): BoardItem =>
  ({
    fontSize: 40,
    id,
    kind: "text",
    textStyle: { color, family },
  }) as unknown as BoardItem;

describe("sharedPatch", () => {
  it("changes only what was touched, on every layer", () => {
    const a = text("a", "#ff0000", "g:Inter");
    const b = text("b", "#00ff00", "g:Lora");
    const out = sharedPatch(
      a,
      {
        textStyle: {
          color: "#ff0000",
          family: "g:Inter",
          weight: 700,
        } as unknown as TextStyle,
      },
      [a, b]
    );
    expect(out.get("b")?.textStyle).toMatchObject({
      color: "#00ff00",
      family: "g:Lora",
      weight: 700,
    });
    expect(sharedPatch(a, { fontSize: 200 }, [a, b]).get("b")?.fontSize).toBe(
      200
    );
  });

  it("doesn't turn a star into a rounded rectangle", () => {
    const rect = {
      config: { fill: "#111111", tool: "rect" },
      id: "r",
      kind: "drawing",
    } as unknown as BoardItem;
    const star = {
      config: { fill: "#222222", sides: 5, tool: "star" },
      id: "s",
      kind: "drawing",
    } as unknown as BoardItem;
    const out = sharedPatch(
      rect,
      { config: { fill: "#111111", radius: 12, tool: "rounded" } },
      [rect, star]
    );
    expect(out.get("r")?.config).toMatchObject({ tool: "rounded" });
    expect(out.get("s")?.config).toMatchObject({
      fill: "#222222",
      radius: 12,
      tool: "star",
    });
  });
});
