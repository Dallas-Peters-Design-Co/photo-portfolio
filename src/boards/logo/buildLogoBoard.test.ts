import { describe, expect, it } from "vitest";
import {
  checkWire,
  type GraphItem,
  hasCycle,
  withWire,
} from "../../../config/graph.js";
import { NODE_TYPES } from "../../../config/nodeTypes.js";
import type { BoardItem, BoardWire } from "../../types";
import {
  briefPrompt,
  buildLogoBoard,
  directionLines,
  type LogoBrief,
  logoBoardTitle,
  paletteOf,
} from "./buildLogoBoard";
import { DEFAULT_LOGO_MODEL } from "./logoStyles";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const brief = (over: Partial<LogoBrief> = {}): LogoBrief => ({
  brandKitId: null,
  colors: ["#1F4D2B", "#f5efe0"],
  description: "a short-term rental outside Amarillo",
  iterations: 5,
  model: "fal-ai/recraft/v4/pro/text-to-vector",
  name: "Back Acres",
  styles: ["minimal", "lettermark", "wordmark"],
  ...over,
});

const byType = (items: BoardItem[], nodeType: string) =>
  items.find((item) => item.nodeType === nodeType);

const into = (
  wires: BoardWire[],
  from: BoardItem | undefined,
  to: BoardItem | undefined,
  port: string
) =>
  wires.some(
    (w) =>
      w.sourceItemId === from?.id &&
      w.targetItemId === to?.id &&
      w.targetPort === port &&
      w.sourcePort === "out"
  );

/** What the board save keeps — the same steps api/boards/[id].ts takes. */
const saved = (items: BoardItem[], wires: BoardWire[]): BoardWire[] => {
  const graph: GraphItem[] = items.map((item) => ({
    id: item.id,
    kind: item.kind,
    nodeType: item.nodeType,
  }));
  const valid = wires.filter((w) => checkWire(graph, [], w).ok);
  const kept = valid.reduce<BoardWire[]>(
    (all, w) => withWire(graph, all, w) as BoardWire[],
    []
  );
  expect(hasCycle(graph, kept)).toBe(false);
  return kept;
};

describe("buildLogoBoard", () => {
  it("runs the brief through Iterate into one Generate", () => {
    const { items, wires } = buildLogoBoard(brief());
    const prompt = byType(items, "prompt");
    const iterate = byType(items, "iterate");
    const generate = byType(items, "generate");
    expect(into(wires, prompt, iterate, "template")).toBe(true);
    expect(into(wires, iterate, generate, "prompt")).toBe(true);
    expect(items.filter((i) => i.nodeType === "generate")).toHaveLength(1);
  });

  it("puts one direction per line on Iterate, and a slot in the brief", () => {
    const { items } = buildLogoBoard(brief());
    const iterate = byType(items, "iterate");
    expect(iterate?.config?.values).toBe(
      directionLines(["minimal", "lettermark", "wordmark"])
    );
    expect(String(iterate?.config?.values).split("\n")).toHaveLength(3);
    expect(iterate?.config?.split).toBe("lines");
    expect(briefPrompt(brief())).toContain("{}");
    expect(briefPrompt(brief())).toContain('"Back Acres"');
    expect(briefPrompt(brief())).toContain("no tagline");
  });

  it("sets Generate to the chosen model, square, with the variation count", () => {
    const generate = byType(buildLogoBoard(brief()).items, "generate");
    expect(generate?.config?.model).toBe(
      "fal-ai/recraft/v4/pro/text-to-vector"
    );
    expect(generate?.config?.count).toBe(5);
    expect(generate?.config?.size).toBe("square_hd");
  });

  it("appends picked colours to every prompt through Iterate's suffix", () => {
    const { items, wires } = buildLogoBoard(brief());
    const palette = byType(items, "palette");
    expect(palette?.config?.colors).toBe("#1f4d2b, #f5efe0");
    expect(into(wires, palette, byType(items, "iterate"), "suffix")).toBe(true);
    expect(briefPrompt(brief())).not.toContain("#1f4d2b");
  });

  it("wires a chosen kit into Generate alongside Iterate, and drops the palette", () => {
    const { items, wires } = buildLogoBoard(brief({ brandKitId: "kit-1" }));
    const brand = byType(items, "brand");
    const generate = byType(items, "generate");
    expect(brand?.config?.brandKitId).toBe("kit-1");
    expect(into(wires, brand, generate, "prompt")).toBe(true);
    expect(byType(items, "palette")).toBeUndefined();
  });

  it("survives the board save with every wire intact", () => {
    for (const b of [brief(), brief({ brandKitId: "kit-1" })]) {
      const { items, wires } = buildLogoBoard(b);
      expect(saved(items, wires)).toHaveLength(wires.length);
    }
  });

  it("only uses node types and config keys the save will keep", () => {
    for (const b of [brief(), brief({ brandKitId: "kit-1" })]) {
      for (const item of buildLogoBoard(b).items.filter(
        (i) => i.kind === "op"
      )) {
        const type = Object.values(NODE_TYPES).find(
          (t) => t.id === item.nodeType
        );
        expect(type, item.nodeType ?? "").toBeDefined();
        const declared = new Set(type?.settings.map((s) => s.key));
        for (const key of Object.keys(item.config ?? {})) {
          expect(declared.has(key), `${item.nodeType}.${key}`).toBe(true);
        }
      }
    }
  });

  it("skips the palette with no valid colours, and dedupes the rest", () => {
    const none = buildLogoBoard(brief({ colors: ["", "green"] }));
    expect(byType(none.items, "palette")).toBeUndefined();
    expect(paletteOf(brief({ colors: ["#AABBCC", "#aabbcc"] }))).toEqual([
      "#aabbcc",
    ]);
  });

  it("gives everything fresh ids, and wires only between its own items", () => {
    const a = buildLogoBoard(brief());
    const b = buildLogoBoard(brief());
    const ids = new Set(a.items.map((item) => item.id));
    expect(ids.size).toBe(a.items.length);
    for (const item of a.items) {
      expect(item.id).toMatch(UUID);
      expect(b.items.some((other) => other.id === item.id)).toBe(false);
    }
    for (const w of a.wires) {
      expect(ids.has(w.sourceItemId) && ids.has(w.targetItemId)).toBe(true);
    }
  });

  it("puts Picks under Iterate and Generate, as wide as both", () => {
    const { items } = buildLogoBoard(brief());
    const picks = items.find((item) => item.kind === "frame");
    const generate = byType(items, "generate");
    const iterate = byType(items, "iterate");
    expect(picks?.body).toBe("Picks");
    expect(picks?.x).toBe(iterate?.x);
    expect((picks?.x ?? 0) + (picks?.width ?? 0)).toBe(
      (generate?.x ?? 0) + (generate?.width ?? 0)
    );
    expect(picks?.y ?? 0).toBeGreaterThan(
      (generate?.y ?? 0) + (generate?.height ?? 0)
    );
  });

  it("clamps iterations and falls back to one direction", () => {
    const { items } = buildLogoBoard(brief({ iterations: 50, styles: [] }));
    expect(byType(items, "generate")?.config?.count).toBe(8);
    expect(
      String(byType(items, "iterate")?.config?.values).split("\n")
    ).toHaveLength(1);
  });

  it("falls back to the default model, and only offers cleanup for raster", () => {
    const odd = buildLogoBoard(brief({ model: "nope" as never }));
    expect(byType(odd.items, "generate")?.config?.model).toBe(
      DEFAULT_LOGO_MODEL
    );
    const note = (b: LogoBrief) =>
      buildLogoBoard(b).items.find((i) => i.kind === "note")?.body ?? "";
    expect(note(brief())).toContain("already SVG");
    expect(note(brief({ model: "fal-ai/ideogram/v3" }))).toContain("Vectorize");
  });

  it("titles the board after the brand", () => {
    expect(logoBoardTitle(brief())).toBe("Back Acres — logo");
    expect(logoBoardTitle(brief({ name: "  " }))).toBe("Untitled — logo");
  });
});
