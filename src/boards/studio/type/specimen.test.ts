import { describe, expect, it } from "vitest";
import { normalizeTextStyle } from "../../../../config/textStyle.js";
import type { TypeScale } from "../../../../config/typeScale.js";
import { compositionOnBoard } from "../composition";
import { typeSpecimen } from "./specimen";

const scale: TypeScale = {
  spacing: [8, 16],
  styles: [
    {
      case: "uppercase",
      face: "headline",
      lineHeight: 1.1,
      name: "h1",
      size: 64,
      tracking: -0.02,
      weight: 700,
    },
    {
      case: "none",
      face: "body",
      lineHeight: 1.5,
      name: "body",
      size: 16,
      tracking: 0,
      weight: 400,
    },
  ],
};

const faces = {
  body: {
    name: "Satoshi",
    ref: "f:satoshi:Satoshi",
    role: "body",
    weights: [400],
  },
  headline: {
    name: "Fraunces",
    ref: "g:Fraunces",
    role: "headline",
    weights: [700],
  },
};

describe("editable type specimens", () => {
  it("preserves typography through board placement and text-style validation", () => {
    const specimen = typeSpecimen(scale, faces, "Brand");
    const group = compositionOnBoard(specimen, { x: 300, y: 600 }, []);
    const [frame] = group;
    expect(frame).toMatchObject({
      config: { designed: true },
      kind: "frame",
      x: 300,
      y: 600,
    });
    const headline = group.find((item) => item.fontSize === 64);
    const body = group.find((item) => item.fontSize === 16);
    expect(normalizeTextStyle(headline?.textStyle)).toMatchObject({
      family: "g:Fraunces",
      letterSpacing: -0.02,
      lineHeight: 1.1,
      transform: "uppercase",
      weight: 700,
    });
    expect(normalizeTextStyle(body?.textStyle)).toMatchObject({
      family: "f:satoshi:Satoshi",
      lineHeight: 1.5,
      weight: 400,
    });
    for (const item of group.slice(1)) {
      expect(item.x).toBeGreaterThanOrEqual(frame?.x ?? 0);
      expect(item.y).toBeGreaterThanOrEqual(frame?.y ?? 0);
      expect(item.x + item.width).toBeLessThanOrEqual(
        (frame?.x ?? 0) + specimen.width
      );
      expect(item.y + item.height).toBeLessThanOrEqual(
        (frame?.y ?? 0) + specimen.height
      );
      expect(item.z).toBeGreaterThan(frame?.z ?? 0);
      expect(item.imageUrl).toBeNull();
    }
  });

  it("uses brand colors and fresh identities when placed again", () => {
    const specimen = typeSpecimen(scale, faces, "Brand", [
      { name: "Paper", role: "background", value: "#fff4df" },
      { name: "Ink", role: "ink", value: "#041045" },
    ]);
    expect(specimen.items[0]?.config?.fill).toBe("#fff4df");
    expect(
      specimen.items.find((item) => item.fontSize === 64)?.textStyle?.color
    ).toBe("#041045");
    const first = compositionOnBoard(specimen, { x: 0, y: 0 }, []);
    const next = compositionOnBoard(specimen, { x: 2000, y: 0 }, first);
    expect(new Set([...first, ...next].map((item) => item.id)).size).toBe(
      first.length + next.length
    );
    expect(Math.min(...next.map((item) => item.z))).toBeGreaterThan(
      Math.max(...first.map((item) => item.z))
    );
  });
});
