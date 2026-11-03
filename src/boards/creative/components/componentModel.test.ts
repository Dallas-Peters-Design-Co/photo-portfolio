import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../../types";
import {
  type BrandComponent,
  copyOf,
  detachCopy,
  draftFrom,
  linkOf,
  placeIn,
  resetCopy,
  syncAll,
} from "./componentModel";

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    body: null,
    config: null,
    creditName: null,
    creditUrl: null,
    fontSize: null,
    height: 100,
    id: Math.random().toString(36).slice(2),
    imageUrl: null,
    kind: "text",
    nodeType: null,
    photoId: null,
    result: null,
    runError: null,
    runState: null,
    thumbUrl: null,
    width: 100,
    x: 0,
    y: 0,
    z: 0,
    ...over,
  }) as BoardItem;

const frame = item({ height: 5400, kind: "frame", width: 3600, x: 0, y: 0 });
const tag = item({
  body: "Vision",
  fontSize: 100,
  textStyle: {
    align: "center",
    background: "#04242b",
    color: "#86d4e9",
    family: "g:Geist Mono",
    italic: null,
    letterSpacing: null,
    lineHeight: 1.3,
    transform: null,
    weight: 700,
  },
  width: 524,
  x: 2900,
  y: 1766,
  z: 5,
});
const box = item({
  config: { fill: "#04242b", stroke: "#000000", strokeWidth: 0, tool: "rect" },
  height: 200,
  kind: "drawing",
  width: 600,
  x: 2860,
  y: 1740,
  z: 4,
});

const ID = "0b9f3c1e-6b8a-4e3c-9f55-2c1d4e5f6a7b";
const save = (
  draft: ReturnType<typeof draftFrom>,
  v = "v1"
): BrandComponent => ({ ...draft, id: ID, kitId: "kit", updatedAt: v });

describe("brand components", () => {
  const component = save(draftFrom([tag, box], frame, "Vision tag"));

  it("saves a group relative to its own corner, back to front, and where it sat", () => {
    expect(component.width).toBe(600);
    expect(component.layers.map((l) => [l.kind, l.x, l.y])).toEqual([
      ["drawing", 0, 0],
      ["text", 40, 26],
    ]);
    expect(component.placement).toEqual({
      frameHeight: 5400,
      frameWidth: 3600,
      x: 2860,
      y: 1740,
    });
  });

  it("drops a copy in the same place on another frame of the same size", () => {
    const other = { ...frame, x: 4000 };
    const at = placeIn(component, other);
    expect(at).toEqual({ x: 6860, y: 1740 });
    const copy = copyOf(component, at, [frame, other]);
    expect(copy.map((l) => [l.x, l.y, l.body])).toEqual([
      [6860, 1740, null],
      [6900, 1766, "Vision"],
    ]);
    expect(new Set(copy.map((l) => linkOf(l)?.i)).size).toBe(1);
  });

  it("brings copies in line with an update, keeping each copy's own text, colour and size", () => {
    const a = copyOf(component, { x: 4000, y: 100 }, []);
    const b = copyOf(component, { x: 9000, y: 100 }, []);
    // Copy b: its own words, colour and size; and the whole copy moved.
    const bOwn = b.map((l) =>
      l.kind === "text"
        ? {
            ...l,
            body: "Mission",
            fontSize: 140,
            textStyle: {
              ...l.textStyle,
              color: "#fcf496",
            } as BoardItem["textStyle"],
            x: l.x + 50,
          }
        : { ...l, x: l.x + 50 }
    );
    // The component: tag text recoloured, box fill changed, tag nudged down.
    const updated: BrandComponent = {
      ...component,
      layers: component.layers.map((l) =>
        l.kind === "text"
          ? {
              ...l,
              textStyle: {
                ...l.textStyle,
                color: "#ffffff",
              } as BoardItem["textStyle"],
              y: l.y + 10,
            }
          : { ...l, config: { ...l.config, fill: "#2a84f8" } }
      ),
      updatedAt: "v2",
    };
    const next = syncAll([...a, ...bOwn], [updated]) ?? [];
    const textOf = (i: string) =>
      next.find((l) => l.kind === "text" && linkOf(l)?.i === i);
    const boxOf = (i: string) =>
      next.find((l) => l.kind === "drawing" && linkOf(l)?.i === i);
    const ai = linkOf(a[0] as BoardItem)?.i ?? "";
    const bi = linkOf(b[0] as BoardItem)?.i ?? "";

    expect(textOf(ai)).toMatchObject({ body: "Vision", fontSize: 100, y: 136 });
    expect(textOf(ai)?.textStyle?.color).toBe("#ffffff");
    expect(boxOf(ai)?.config?.fill).toBe("#2a84f8");

    // b keeps its own words, size and colour, follows the rest, stays moved.
    expect(textOf(bi)).toMatchObject({
      body: "Mission",
      fontSize: 140,
      x: 9090,
      y: 136,
    });
    expect(textOf(bi)?.textStyle?.color).toBe("#fcf496");
    expect(boxOf(bi)?.config?.fill).toBe("#2a84f8");

    // Already in line: nothing to do.
    expect(syncAll(next, [updated])).toBeNull();
  });

  it("leaves copies alone until the component changes", () => {
    const a = copyOf(component, { x: 4000, y: 100 }, []).map((l) => ({
      ...l,
      x: l.x + 300,
    }));
    expect(syncAll(a, [component])).toBeNull();
  });

  it("resets a copy to the component, and detaches one", () => {
    const a = copyOf(component, { x: 4000, y: 100 }, []).map((l) =>
      l.kind === "text" ? { ...l, body: "Changed" } : l
    );
    const i = linkOf(a[0] as BoardItem)?.i ?? "";
    expect(
      resetCopy(a, component, i).find((l) => l.kind === "text")?.body
    ).toBe("Vision");
    expect(detachCopy(a, i).every((l) => linkOf(l) === null)).toBe(true);
    expect(detachCopy(a, i).find((l) => l.kind === "drawing")?.config).toEqual(
      box.config
    );
  });

  it("swaps in a new layer when the component's picture changes", () => {
    const pic = item({
      imageUrl: "a.svg",
      kind: "reference",
      thumbUrl: "a.svg",
    });
    const withPic = save(draftFrom([pic], frame, "Pic"));
    const copy = copyOf(withPic, { x: 0, y: 0 }, []);
    const next =
      syncAll(copy, [
        {
          ...withPic,
          layers: withPic.layers.map((l) => ({ ...l, imageUrl: "b.svg" })),
          updatedAt: "v2",
        },
      ]) ?? [];
    expect(next[0]?.imageUrl).toBe("b.svg");
    expect(next[0]?.id).not.toBe(copy[0]?.id);
  });
});
