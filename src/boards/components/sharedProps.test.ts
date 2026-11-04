import { expect, it } from "vitest";
import {
  alikeOf,
  type BrandComponent,
  type ComponentLayer,
  resolvedLayers,
} from "./model";

/**
 * Layers alike share a property: tiles of a mark in the same colour are set
 * by one Colour, and a picture's tint can share the label's colour.
 */
const layer = (lid: string, over: Partial<ComponentLayer>): ComponentLayer =>
  ({
    body: null,
    config: null,
    fontSize: null,
    height: 10,
    imageUrl: null,
    kind: "drawing",
    lid,
    rotation: 0,
    textStyle: null,
    thumbUrl: null,
    width: 10,
    x: 0,
    y: 0,
    ...over,
  }) as ComponentLayer;

const component = {
  height: 100,
  id: "c",
  kitId: "k",
  layers: [
    layer("t1", { config: { fill: "#FFFFFF", tool: "rect" } }),
    layer("t2", { config: { fill: "#ffffff", tool: "rect" } }),
    layer("t3", { config: { fill: "#000000", tool: "rect" } }),
    layer("mark", { imageUrl: "https://x/mark.svg", kind: "reference" }),
    layer("label", {
      body: "Assets",
      kind: "text",
      textStyle: { color: "#fcf496" } as ComponentLayer["textStyle"],
    }),
  ],
  name: "Mark",
  placement: {},
  props: [],
  updatedAt: "",
  width: 100,
} as unknown as BrandComponent;

it("finds the layers with the same colour, case aside", () => {
  expect(alikeOf(component, "t1", "fill")).toEqual([
    { field: "fill", lid: "t2" },
  ]);
});

it("sets every layer a property is shared with", () => {
  const shared = {
    ...component,
    props: [
      {
        field: "fill" as const,
        id: "fill",
        lid: "t1",
        more: [{ field: "fill" as const, lid: "t2" }],
        name: "Mark colour",
        type: "color" as const,
      },
      {
        field: "color" as const,
        id: "ink",
        lid: "label",
        more: [{ field: "tint" as const, lid: "mark" }],
        name: "Colour",
        type: "color" as const,
      },
    ],
  };
  const out = resolvedLayers(shared, { fill: "#ff0000", ink: "#00ff00" });
  const by = (lid: string) => out.find((l) => l.lid === lid);
  expect(by("t1")?.config?.fill).toBe("#ff0000");
  expect(by("t2")?.config?.fill).toBe("#ff0000");
  expect(by("t3")?.config?.fill).toBe("#000000");
  expect(by("label")?.textStyle?.color).toBe("#00ff00");
  expect(by("mark")?.config?.tint).toBe("#00ff00");
});
