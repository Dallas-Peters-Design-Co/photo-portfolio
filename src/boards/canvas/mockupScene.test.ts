import { describe, expect, it } from "vitest";
import { apply, mockupScene, wrapWindows } from "./mockupScene";

const W = 2400;
const H = 1800;
const COVER = 1800 / 2700;

describe("mockupScene", () => {
  it("shows the front alone when flat, and the spine as well when angled", () => {
    const flat = mockupScene({
      coverAspect: COVER,
      height: H,
      thickness: 0.13,
      view: "flat",
      width: W,
      wrap: null,
    });
    expect(flat.faces.map((f) => f.source)).toEqual(["cover"]);

    const angled = mockupScene({
      coverAspect: COVER,
      height: H,
      thickness: 0.13,
      view: "angled",
      width: W,
      wrap: null,
    });
    // Spine first, front last: painter's order.
    expect(angled.faces.map((f) => f.source)).toEqual(["paint", "cover"]);
  });

  it("maps the front's corners back to the unit square", () => {
    const { faces } = mockupScene({
      coverAspect: COVER,
      height: H,
      thickness: 0.13,
      view: "angled",
      width: W,
      wrap: null,
    });
    const front = faces.at(-1);
    if (!front) {
      throw new Error("no front");
    }
    // The inverse of a homography that puts the unit square somewhere on the
    // output must take the centre of that somewhere back near (0.5, 0.5).
    // Find the centre by mapping the unit centre forward: invert the inverse
    // numerically by probing.
    const probe = (u: number, v: number) => {
      // Search the output for the pixel whose uv is (u, v) — coarse, but a
      // homography is smooth, so the nearest of a grid is close enough.
      let best: [number, number] = [0, 0];
      let bestErr = Number.POSITIVE_INFINITY;
      for (let x = 0; x < W; x += 8) {
        for (let y = 0; y < H; y += 8) {
          const [pu, pv] = apply(front.inverse, [x, y]);
          const err = (pu - u) ** 2 + (pv - v) ** 2;
          if (err < bestErr) {
            bestErr = err;
            best = [x, y];
          }
        }
      }
      return best;
    };
    const [cx, cy] = probe(0.5, 0.5);
    // Roughly the middle of the frame — the book is centred.
    expect(cx).toBeGreaterThan(W * 0.35);
    expect(cx).toBeLessThan(W * 0.65);
    expect(cy).toBeGreaterThan(H * 0.35);
    expect(cy).toBeLessThan(H * 0.65);
    // And the top-left corner sits above and left of the centre.
    const [tx, ty] = probe(0, 0);
    expect(tx).toBeLessThan(cx);
    expect(ty).toBeLessThan(cy);
  });

  it("fills most of the height and leaves a margin", () => {
    const { faces } = mockupScene({
      coverAspect: COVER,
      height: H,
      thickness: 0.13,
      view: "flat",
      width: W,
      wrap: null,
    });
    const face = faces[0];
    const inside = (x: number, y: number) => {
      const [u, v] = apply(face.inverse, [x, y]);
      return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    };
    expect(inside(W / 2, H / 2)).toBe(true);
    expect(inside(W / 2, H * 0.05)).toBe(false);
    expect(inside(W / 2, H * 0.2)).toBe(true);
    expect(inside(W / 2, H * 0.8)).toBe(true);
    expect(inside(W / 2, H * 0.97)).toBe(false);
  });

  it("uses a wired wrap for the spine and the front", () => {
    const wrap = wrapWindows(3910 / 2776, 6, 9);
    const { faces } = mockupScene({
      coverAspect: COVER,
      height: H,
      thickness: wrap.spineIn / 6,
      view: "angled",
      width: W,
      wrap,
    });
    expect(faces.map((f) => f.source)).toEqual(["wrap", "wrap"]);
    expect(faces[0].window[0]).toBeCloseTo(wrap.spineU0, 6);
    expect(faces[1].window[0]).toBeCloseTo(wrap.frontU0, 6);
  });

  it("lays the whole wrap out when spread", () => {
    const wrap = wrapWindows(3910 / 2776, 6, 9);
    const { faces } = mockupScene({
      coverAspect: COVER,
      height: H,
      thickness: 0.13,
      view: "spread",
      width: W,
      wrap,
    });
    expect(faces).toHaveLength(1);
    expect(faces[0].source).toBe("wrap");
    expect(faces[0].window).toEqual([0, 0, 1, 1]);
  });
});

describe("wrapWindows", () => {
  it("reads Centrifuge's spine back out of the wrap's proportions", () => {
    const w = wrapWindows(3910 / 2776, 6, 9);
    expect(w.spineIn).toBeCloseTo(0.78, 1);
    expect(w.frontU1 - w.frontU0).toBeCloseTo(6 / 13.03, 2);
    expect(w.v0).toBeCloseTo(0.125 / 9.25, 4);
  });
});
