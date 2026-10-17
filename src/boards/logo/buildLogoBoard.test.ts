import { describe, expect, it } from "vitest";
import { NODE_TYPES } from "../../../config/nodeTypes.js";
import {
  briefPrompt,
  buildLogoBoard,
  LOGO_MODEL,
  type LogoBrief,
  logoBoardTitle,
} from "./buildLogoBoard";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const brief = (over: Partial<LogoBrief> = {}): LogoBrief => ({
  brandKitId: null,
  colors: "deep green and cream",
  description: "a short-term rental outside Amarillo",
  iterations: 5,
  name: "Back Acres",
  styles: ["minimal", "lettermark", "wordmark"],
  ...over,
});

const generates = (items: ReturnType<typeof buildLogoBoard>["items"]) =>
  items.filter((item) => item.nodeType === "generate");

describe("buildLogoBoard", () => {
  it("makes one Generate node per direction, pinned to the logo model", () => {
    const { items } = buildLogoBoard(brief());
    const nodes = generates(items);
    expect(nodes).toHaveLength(3);
    for (const node of nodes) {
      expect(node.config?.model).toBe(LOGO_MODEL);
      expect(node.config?.count).toBe(5);
      expect(node.config?.size).toBe("square_hd");
      expect(typeof node.config?.prompt).toBe("string");
    }
  });

  it("wires the brief into every direction", () => {
    const { items, wires } = buildLogoBoard(brief());
    const briefNode = items.find((item) => item.nodeType === "prompt");
    expect(briefNode).toBeDefined();
    for (const node of generates(items)) {
      expect(
        wires.some(
          (w) =>
            w.sourceItemId === briefNode?.id &&
            w.targetItemId === node.id &&
            w.targetPort === "prompt" &&
            w.sourcePort === "out"
        )
      ).toBe(true);
    }
  });

  it("adds a Brand node, wired in, only when a kit is chosen", () => {
    expect(
      buildLogoBoard(brief()).items.some((item) => item.nodeType === "brand")
    ).toBe(false);

    const { items, wires } = buildLogoBoard(brief({ brandKitId: "kit-1" }));
    const brand = items.find((item) => item.nodeType === "brand");
    expect(brand?.config?.brandKitId).toBe("kit-1");
    expect(wires.filter((w) => w.sourceItemId === brand?.id)).toHaveLength(3);
  });

  it("leaves colours in words out of the brief when a kit supplies them", () => {
    expect(briefPrompt(brief())).toContain("deep green and cream");
    expect(briefPrompt(brief({ brandKitId: "kit-1" }))).not.toContain(
      "deep green"
    );
    expect(briefPrompt(brief())).toContain('"Back Acres"');
  });

  it("only uses node types and config keys the save will keep", () => {
    const { items } = buildLogoBoard(brief({ brandKitId: "kit-1" }));
    for (const item of items.filter((i) => i.kind === "op")) {
      const type = Object.values(NODE_TYPES).find(
        (t) => t.id === item.nodeType
      );
      expect(type, item.nodeType ?? "").toBeDefined();
      const declared = new Set(type?.settings.map((s) => s.key));
      for (const key of Object.keys(item.config ?? {})) {
        expect(declared.has(key), `${item.nodeType}.${key}`).toBe(true);
      }
    }
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

  it("puts a Picks frame under the directions, wide enough for the row", () => {
    const { items } = buildLogoBoard(brief());
    const picks = items.find((item) => item.kind === "frame");
    const nodes = generates(items);
    const right = Math.max(...nodes.map((n) => n.x + n.width));
    expect(picks?.body).toBe("Picks");
    expect((picks?.x ?? 0) + (picks?.width ?? 0)).toBeGreaterThanOrEqual(right);
    for (const node of nodes) {
      expect(picks?.y ?? 0).toBeGreaterThan(node.y + node.height);
    }
  });

  it("clamps iterations and falls back to one direction", () => {
    const { items } = buildLogoBoard(brief({ iterations: 50, styles: [] }));
    const nodes = generates(items);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.config?.count).toBe(8);
  });

  it("titles the board after the brand", () => {
    expect(logoBoardTitle(brief())).toBe("Back Acres — logo");
    expect(logoBoardTitle(brief({ name: "  " }))).toBe("Untitled — logo");
  });
});
