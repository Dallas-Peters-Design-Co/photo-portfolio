import { describe, expect, it } from "vitest";
import {
  backWithBleed,
  frontWithBleed,
  pagesFrom,
  px,
  spineWithBleed,
  wrapSpec,
} from "./wrapLayout";

describe("wrapSpec", () => {
  /*
   * Centrifuge: 312 pages on cream, 6×9. The numbers KDP's calculator gives
   * for that book, which is what _pipeline/scripts/kdp-wrap.py was checked
   * against before this replaced it.
   */
  const spec = wrapSpec("6x9", "cream", 312);

  it("gets the spine right for Centrifuge", () => {
    expect(spec.spineIn).toBeCloseTo(0.78, 4);
    expect(spec.spine.width).toBe(234);
  });

  it("sizes the file at 300 dpi with bleed on every side", () => {
    expect(spec.canvasIn.width).toBeCloseTo(13.03, 3);
    expect(spec.canvasIn.height).toBeCloseTo(9.25, 3);
    // A pixel over the inch-exact 3909×2775: the bleed is 37.5 px and is
    // rounded up on both sides so the panels tile without a seam. The PDF is
    // placed by inches, so the sheet is still 13.03 × 9.25.
    expect(spec.canvas).toEqual({ height: 2776, width: 3910 });
  });

  it("puts back, spine and front side by side with nothing between", () => {
    expect(spec.back.x).toBe(spec.bleedPx);
    expect(spec.spine.x).toBe(spec.back.x + spec.back.width);
    expect(spec.front.x).toBe(spec.spine.x + spec.spine.width);
    expect(spec.front.x + spec.front.width + spec.bleedPx).toBe(
      spec.canvas.width
    );
  });

  it("keeps the barcode zone inside the back's live area, lower right", () => {
    const { barcode, backSafe } = spec;
    expect(barcode.x).toBeGreaterThanOrEqual(backSafe.x);
    expect(barcode.y).toBeGreaterThanOrEqual(backSafe.y);
    expect(barcode.x + barcode.width).toBe(backSafe.x + backSafe.width);
    expect(barcode.y + barcode.height).toBe(backSafe.y + backSafe.height);
    expect(barcode.width).toBe(px(2));
    expect(barcode.height).toBe(px(1.2));
  });

  it("allows spine text at 79 pages and refuses it under", () => {
    expect(wrapSpec("6x9", "white", 78).spineTextAllowed).toBe(false);
    expect(wrapSpec("6x9", "white", 79).spineTextAllowed).toBe(true);
  });

  it("takes KDP's margin off both sides of the spine for text", () => {
    expect(spec.spineSafe.width).toBe(spec.spine.width - px(0.0625) * 2);
    expect(spec.spineSafe.x).toBe(spec.spine.x + px(0.0625));
  });

  it("clamps an absurd page count rather than making a yard of spine", () => {
    expect(wrapSpec("6x9", "white", 5).pages).toBe(24);
    expect(wrapSpec("6x9", "white", 9000).pages).toBe(828);
  });

  it("makes a thicker spine on cream than white for the same book", () => {
    expect(wrapSpec("6x9", "cream", 312).spineIn).toBeGreaterThan(
      wrapSpec("6x9", "white", 312).spineIn
    );
  });
});

describe("bleed boxes", () => {
  const spec = wrapSpec("6x9", "cream", 312);

  it("runs the front out to the top, right and bottom edges only", () => {
    const box = frontWithBleed(spec);
    expect(box.x).toBe(spec.front.x);
    expect(box.y).toBe(0);
    expect(box.x + box.width).toBe(spec.canvas.width);
    expect(box.y + box.height).toBe(spec.canvas.height);
  });

  it("runs the back out to the top, left and bottom edges only", () => {
    const box = backWithBleed(spec);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.x + box.width).toBe(spec.spine.x);
    expect(box.height).toBe(spec.canvas.height);
  });

  it("runs the spine top to bottom and no wider", () => {
    const box = spineWithBleed(spec);
    expect(box.width).toBe(spec.spine.width);
    expect(box.height).toBe(spec.canvas.height);
  });
});

describe("pagesFrom", () => {
  it("reads a number, a numeric string, and a string with noise", () => {
    expect(pagesFrom(312)).toBe(312);
    expect(pagesFrom("312")).toBe(312);
    expect(pagesFrom("312 pages")).toBe(312);
  });

  it("falls back for nothing or nonsense", () => {
    expect(pagesFrom("")).toBe(300);
    expect(pagesFrom(undefined, 200)).toBe(200);
    expect(pagesFrom("zero")).toBe(300);
  });
});
