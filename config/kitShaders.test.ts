import { describe, expect, it } from "vitest";
import { EMPTY_KIT, resolveKitDoc, sanitizeKitDoc } from "./brandKit";
import { cleanKitShader, MAX_KIT_SHADERS } from "./kitShaders";

const glow = {
  id: "s1",
  layers: [
    {
      children: [{ id: "c1", name: "Plasma", props: { speed: 0.4 } }],
      id: "e1",
      name: "Bloom",
      props: { intensity: 1.2 },
    },
  ],
  name: "Brand glow",
};

describe("kit shaders", () => {
  it("keeps a stack's layers, nesting and props", () => {
    expect(cleanKitShader(glow)).toEqual(glow);
  });

  it("drops layers with a bad name and shaders with nothing left", () => {
    expect(
      cleanKitShader({
        ...glow,
        layers: [{ id: "x", name: "<script>", props: {} }],
      })
    ).toBeNull();
    expect(cleanKitShader({ ...glow, name: "" })).toBeNull();
  });

  it("survives a kit save, capped in number", () => {
    const doc = sanitizeKitDoc({
      shaders: Array.from({ length: MAX_KIT_SHADERS + 3 }, (_, i) => ({
        ...glow,
        id: `s${i}`,
      })),
    });
    expect(doc.shaders).toHaveLength(MAX_KIT_SHADERS);
    expect(doc.shaders[0]?.layers[0]?.children?.[0]?.name).toBe("Plasma");
  });

  it("a sub-brand with none uses its parent's", () => {
    const parent = { ...EMPTY_KIT, shaders: [glow] };
    expect(resolveKitDoc(EMPTY_KIT, parent).shaders[0]?.name).toBe(
      "Brand glow"
    );
  });
});
