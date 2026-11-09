import { describe, expect, it } from "vitest";
import { defaultsOf } from "../tools";
import type { StudioValues } from "../types";
import { liquidTool, oklabOf } from "./liquid";
import { LIQUID_LOOKS, liquidLimit } from "./liquidGl";

const PALETTE = ["#041045", "#1e3dff", "#8fd6e8", "#f6f4ef"];
const PNG_DATA = /^data:image\/png;base64,/;
const W = 64;
const H = 36;

/** The preview's pixels for these settings, without grain unless asked. */
const pixels = (values: StudioValues, palette = PALETTE) => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  liquidTool.draw?.(
    g,
    { ...defaultsOf(liquidTool.params), grain: 0, ...values },
    { height: H * 10, image: null, palette, width: W * 10 }
  );
  return g.getImageData(0, 0, W, H).data;
};

/** The biggest difference in any channel between two sets of pixels. */
const apart = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let most = 0;
  for (let at = 0; at < a.length; at += 1) {
    most = Math.max(most, Math.abs((a[at] ?? 0) - (b[at] ?? 0)));
  }
  return most;
};

describe("Liquid Gradients", () => {
  it("has WebGL to draw with here, so these tests are of the shader", () => {
    expect(liquidLimit()).toBeGreaterThan(0);
  });

  it("puts black, white and a grey where OKLab says they are", () => {
    expect(oklabOf("#000000")[0]).toBeCloseTo(0, 5);
    expect(oklabOf("#ffffff")[0]).toBeCloseTo(1, 3);
    const [, a, b] = oklabOf("#808080");
    expect(Math.abs(a)).toBeLessThan(1e-4);
    expect(Math.abs(b)).toBeLessThan(1e-4);
    // The short form and an alpha on the end read as the same colour.
    expect(oklabOf("#fff")).toEqual(oklabOf("#ffffff80"));
  });

  for (const look of LIQUID_LOOKS) {
    it(`${look}: one colour in is that colour out, everywhere`, () => {
      const data = pixels({ look }, ["#ff6b4a"]);
      for (let at = 0; at < data.length; at += 4) {
        expect(Math.abs((data[at] ?? 0) - 0xff)).toBeLessThanOrEqual(2);
        expect(Math.abs((data[at + 1] ?? 0) - 0x6b)).toBeLessThanOrEqual(2);
        expect(Math.abs((data[at + 2] ?? 0) - 0x4a)).toBeLessThanOrEqual(2);
      }
    });

    it(`${look}: a seed draws the same picture, another a different one`, () => {
      const first = pixels({ look, seed: 42 });
      expect(apart(first, pixels({ look, seed: 42 }))).toBe(0);
      expect(apart(first, pixels({ look, seed: 43 }))).toBeGreaterThan(20);
    });

    it(`${look}: the loop joins up, and moves in between`, () => {
      const start = pixels({ liquidPhase: 0, look, seed: 7 });
      // One step of 8 bits: the two ends are the same sum taken a turn apart.
      expect(
        apart(start, pixels({ liquidPhase: 1, look, seed: 7 }))
      ).toBeLessThanOrEqual(1);
      expect(
        apart(start, pixels({ liquidPhase: 0.5, look, seed: 7 }))
      ).toBeGreaterThan(20);
      // The slider and a video read the same loop.
      expect(
        apart(
          pixels({ liquidPhase: 0.25, look, seed: 7 }),
          pixels({ look, moment: 25, seed: 7 })
        )
      ).toBe(0);
    });
  }

  it("uses every colour it is given, not just the middle of the ramp", () => {
    const data = pixels({ look: "silk", seed: 42 });
    const near = (hex: string) => {
      const want = [1, 3, 5].map((i) =>
        Number.parseInt(hex.slice(i, i + 2), 16)
      );
      for (let at = 0; at < data.length; at += 4) {
        const off = want.map((c, k) => Math.abs(c - (data[at + k] ?? 0)));
        if (Math.max(...off) < 24) {
          return true;
        }
      }
      return false;
    };
    for (const colour of PALETTE) {
      expect(near(colour), colour).toBe(true);
    }
  });

  it("draws a poster bigger than the GPU can, stretched to the size asked", () => {
    const side = liquidLimit() * 2;
    const svg = liquidTool.render(
      { ...defaultsOf(liquidTool.params), grain: 12 },
      { height: side, image: null, palette: PALETTE, width: side / 2 }
    );
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    const image = doc.querySelector("image");
    expect(image?.getAttribute("width")).toBe(String(side / 2));
    expect(image?.getAttribute("height")).toBe(String(side));
    expect(image?.getAttribute("href")).toMatch(PNG_DATA);
    // The grain is a filter over the top, so it is not stretched with it.
    expect(doc.querySelector("filter#g")).not.toBeNull();
  });

  it("leaves the grain out at 0", () => {
    const svg = liquidTool.render(
      { ...defaultsOf(liquidTool.params), grain: 0 },
      { height: 90, image: null, palette: PALETTE, width: 160 }
    );
    expect(svg).not.toContain("filter");
  });
});
