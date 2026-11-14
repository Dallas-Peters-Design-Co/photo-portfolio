import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import {
  type BrandComponent,
  draftFrom,
  expandAll,
  expandInstance,
  newInstance,
  placeIn,
  propValue,
} from "./model";

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

const frame = item({ height: 5400, kind: "frame", width: 3600 });
const text = item({
  body: "Vision",
  fontSize: 100,
  textStyle: { color: "#86d4e9" } as BoardItem["textStyle"],
  width: 524,
  x: 2900,
  y: 1766,
  z: 5,
});
const box = item({
  config: { fill: "#04242b", stroke: "#000", strokeWidth: 4, tool: "rect" },
  height: 200,
  kind: "drawing",
  width: 600,
  x: 2860,
  y: 1740,
  z: 4,
});

const draft = draftFrom([text, box], frame, "Vision tag");
const [boxLayer, textLayer] = draft.layers;
const component: BrandComponent = {
  ...draft,
  id: "0b9f3c1e-6b8a-4e3c-9f55-2c1d4e5f6a7b",
  kitId: "kit",
  props: [
    {
      field: "body",
      id: "label",
      lid: textLayer?.lid ?? "",
      name: "Label",
      type: "text",
    },
    {
      field: "fill",
      id: "bg",
      lid: boxLayer?.lid ?? "",
      name: "Background",
      type: "color",
    },
  ],
  updatedAt: "v1",
};

describe("components", () => {
  it("saves layers relative to their corner, back to front", () => {
    expect(draft.width).toBe(600);
    expect(draft.layers.map((l) => [l.kind, l.x, l.y])).toEqual([
      ["drawing", 0, 0],
      ["text", 40, 26],
    ]);
  });

  it("places one instance where the component sat, and draws it from the component", () => {
    const at = placeIn(component, { ...frame, x: 4000 });
    const inst = newInstance(component, at, [frame]);
    expect(inst).toMatchObject({
      height: 200,
      kind: "component",
      width: 600,
      x: 6860,
      y: 1740,
    });
    const drawn = expandInstance(inst, component);
    expect(drawn.map((l) => [l.kind, l.x, l.y, l.body])).toEqual([
      ["drawing", 6860, 1740, null],
      ["text", 6900, 1766, "Vision"],
    ]);
  });

  it("applies an instance's property values, and falls back to the component's", () => {
    const inst = {
      ...newInstance(component, { x: 0, y: 0 }, []),
      config: { component: component.id, props: { label: "Mission" } },
    };
    const [b, t] = expandInstance(inst, component);
    expect(t?.body).toBe("Mission");
    expect(b?.config?.fill).toBe("#04242b");
    const [prop0, prop1] = component.props;
    expect(prop0 && propValue(component, prop0, { label: "Mission" })).toBe(
      "Mission"
    );
    expect(prop1 && propValue(component, prop1, {})).toBe("#04242b");
  });

  it("scales into a resized box, type and outlines with it", () => {
    const inst = {
      ...newInstance(component, { x: 0, y: 0 }, []),
      height: 100,
      width: 300,
    };
    const [b, t] = expandInstance(inst, component);
    expect(t).toMatchObject({ fontSize: 50, width: 262, x: 20, y: 13 });
    expect(b?.config?.strokeWidth).toBe(2);
  });

  it("stretches to fill a box resized one way, without blowing the type up", () => {
    const inst = {
      ...newInstance(component, { x: 0, y: 0 }, []),
      height: 200,
      width: 1200,
    };
    const [b, t] = expandInstance(inst, component);
    // Twice as wide: the box and the text's line fill the new width…
    expect(b).toMatchObject({ height: 200, width: 1200, x: 0 });
    expect(t).toMatchObject({ width: 1048, x: 80 });
    // …and the type stays its size, since the height didn't change.
    expect(t?.fontSize).toBe(100);
  });

  it("leaves everything else, and unknown components, alone when expanding", () => {
    const inst = newInstance(component, { x: 0, y: 0 }, []);
    const other = item({ kind: "text" });
    const lost = { ...inst, config: { component: "missing", props: {} } };
    const out = expandAll([other, inst, lost], (id) =>
      id === component.id ? component : null
    );
    expect(out).toHaveLength(4);
    expect(out[3]).toBe(lost);
  });
});
