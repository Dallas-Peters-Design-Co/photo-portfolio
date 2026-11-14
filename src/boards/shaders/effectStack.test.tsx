import "../../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import { ShaderPanel } from "./ShaderPanel";
import type { ShaderLayer } from "./shaderConfig";
import { reactSource } from "./shaderReact";
import { activeLayers, chainOf, layersOfChain } from "./shaderStack";

/**
 * The stack as a list.
 *
 * A chain of effects over one source reads as a list with a switch per row;
 * only a branching stack keeps the tree. The switch leaves the layer in place
 * and takes it out of the render, so the picture under it shows through and
 * the settings are still there when it comes back.
 */

const layer = (
  name: string,
  id: string,
  over: Partial<ShaderLayer> = {}
): ShaderLayer => ({ id, name, props: {}, ...over });

const chain: ShaderLayer[] = [
  layer("Glass", "g", {
    children: [
      layer("Halftone", "h", {
        children: [layer("MeshGradient", "m", { props: { speed: 0.5 } })],
      }),
    ],
  }),
];

describe("a stack as a chain", () => {
  it("reads a single chain as a list, outermost first", () => {
    expect(chainOf(chain)).toEqual({
      effects: [
        expect.objectContaining({ id: "g" }),
        expect.objectContaining({ id: "h" }),
      ],
      source: expect.objectContaining({ id: "m" }),
    });
    expect(layersOfChain(chainOf(chain) as never)).toEqual(chain);
  });

  it("is not a chain once a level holds two things", () => {
    expect(
      chainOf([
        layer("Group", "grp", {
          children: [layer("Plasma", "p"), layer("Circle", "c")],
        }),
      ])
    ).toBeNull();
    expect(chainOf([layer("Plasma", "p"), layer("Circle", "c")])).toBeNull();
  });

  it("an effect fed by a wire is a chain with no source", () => {
    expect(chainOf([layer("Dither", "d", { children: [] })])).toEqual({
      effects: [expect.objectContaining({ id: "d" })],
      source: null,
    });
  });

  it("drops a switched-off effect from the render and keeps what it held", () => {
    const off = layersOfChain({
      effects: [
        layer("Glass", "g", { enabled: false }),
        layer("Halftone", "h"),
      ],
      source: layer("Plasma", "p"),
    });
    expect(activeLayers(off)).toEqual([
      {
        children: [layer("Plasma", "p")],
        id: "h",
        name: "Halftone",
        props: {},
      },
    ]);
    // Off is remembered, not deleted: the chain still lists it.
    expect(chainOf(off)?.effects.map((e) => e.id)).toEqual(["g", "h"]);
  });
});

describe("the stack as a React component", () => {
  it("writes the live tree with its changed props and one import line", () => {
    const src = reactSource(chain, null, "Hero backdrop");
    expect(src).toContain(
      'import { Shader, Glass, Halftone, MeshGradient } from "shaders/react";'
    );
    expect(src).toContain("export default function HeroBackdrop()");
    expect(src).toContain("<Glass>");
    expect(src).toContain("<Halftone>");
    expect(src).toContain("<MeshGradient speed={0.5} />");
  });

  it("binds the wired picture with the fit chosen for it", () => {
    const src = reactSource(
      [layer("Glass", "g", { children: [] })],
      "https://example.test/pic.png",
      null,
      "cover"
    );
    expect(src).toContain('<ImageTexture objectFit="cover" url=');
  });

  it("leaves out a switched-off effect and binds a wired picture", () => {
    const src = reactSource(
      [layer("Glass", "g", { children: [], enabled: false })],
      "https://example.test/pic.png",
      null
    );
    expect(src).not.toContain("<Glass");
    expect(src).toContain(
      '<ImageTexture objectFit="contain" url="https://example.test/pic.png" />'
    );
    expect(src).toContain("export default function Backdrop()");
  });
});

describe("the effect stack in the panel", () => {
  let host: HTMLDivElement | null = null;
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  const shader = (layers: ShaderLayer[]): BoardItem => ({
    body: null,
    config: { layers },
    creditName: null,
    creditUrl: null,
    fontSize: null,
    height: 320,
    id: "s1",
    imageUrl: null,
    kind: "shader",
    nodeType: null,
    photoId: null,
    result: null,
    runError: null,
    runState: "idle",
    textStyle: null,
    thumbUrl: null,
    width: 320,
    x: 0,
    y: 0,
    z: 1,
  });

  it("shows a chain as rows with switches, and a switch turns a layer off", () => {
    const onConfigChange = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <ShaderPanel
          onConfigChange={onConfigChange}
          onExport={() => Promise.resolve()}
          selected={shader(chain)}
        />
      )
    );
    const rows = [...host.querySelectorAll(".effect-row")];
    expect(
      rows.map((r) => r.querySelector(".effect-row__name")?.textContent)
    ).toEqual(["Glass", "Halftone", "Mesh Gradient"]);
    const switches = host.querySelectorAll<HTMLButtonElement>("[role=switch]");
    // Two effects get a switch; the source does not.
    expect(switches).toHaveLength(2);
    expect(switches[0]?.getAttribute("aria-checked")).toBe("true");
    act(() => switches[0]?.click());
    const next = onConfigChange.mock.calls[0]?.[1] as { layers: ShaderLayer[] };
    expect(next.layers[0]?.enabled).toBe(false);
    expect(next.layers[0]?.children?.[0]?.id).toBe("h");
    // Still a tree underneath, so the canvas and the export read it unchanged.
    expect(activeLayers(next.layers)[0]?.name).toBe("Halftone");
  });

  it("keeps the tree view for a stack that branches", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <ShaderPanel
          onConfigChange={() => undefined}
          onExport={() => Promise.resolve()}
          selected={shader([
            layer("Group", "grp", {
              children: [layer("Plasma", "p"), layer("Circle", "c")],
            }),
          ])}
        />
      )
    );
    expect(host.querySelector(".effect-row")).toBeNull();
    expect(host.querySelectorAll(".shader-layer").length).toBeGreaterThan(1);
  });
});
