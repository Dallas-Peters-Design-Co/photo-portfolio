import { pick, r2, rng, svgDoc } from "../rng";
import type { ImageTool } from "../types";

/**
 * Soft mesh gradient backgrounds, after Background Studio and Sfumato: a
 * few large blurred colour fields over a ground colour, with optional film
 * grain. All colours come from the brand unless the ground is set.
 */

const grain = (amount: number) =>
  amount <= 0
    ? ""
    : `<filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="${r2(amount / 100)}"/></feComponentTransfer></filter>`;

export const meshTool: ImageTool = {
  blurb: "Soft, blurred colour fields from the brand palette, with grain.",
  id: "mesh",
  kind: "image",
  name: "Gradient Backgrounds",
  params: [
    { count: 5, key: "colors", label: "Colours", max: 8, type: "colors" },
    { key: "seed", label: "Seed", type: "seed" },
    {
      default: 5,
      key: "points",
      label: "Colour fields",
      max: 9,
      min: 2,
      type: "range",
    },
    {
      default: 60,
      key: "blur",
      label: "Softness",
      max: 100,
      min: 10,
      type: "range",
    },
    {
      default: 100,
      key: "scale",
      label: "Field size",
      max: 180,
      min: 40,
      type: "range",
    },
    {
      default: 18,
      key: "grain",
      label: "Grain",
      max: 60,
      min: 0,
      type: "range",
    },
    {
      default: "first",
      key: "ground",
      label: "Ground",
      options: [
        { label: "First brand colour", value: "first" },
        { label: "Lightest", value: "light" },
        { label: "Darkest", value: "dark" },
      ],
      type: "select",
    },
  ],
  render: (v, { height: h, palette, width: w }) => {
    const random = rng(Number(v.seed) || 1);
    const byLight = [...palette].sort((a, b) => luma(b) - luma(a));
    const grounds: Record<string, string | undefined> = {
      dark: byLight.at(-1),
      first: palette[0],
      light: byLight[0],
    };
    const ground = grounds[String(v.ground)] ?? palette[0];
    const size = Math.max(w, h);
    const blur = r2((Number(v.blur) / 100) * size * 0.18);
    const fields = Array.from({ length: Number(v.points) || 5 }, (_, i) => {
      const r = r2(size * (0.25 + random() * 0.35) * (Number(v.scale) / 100));
      return `<ellipse cx="${r2(random() * w)}" cy="${r2(random() * h)}" rx="${r}" ry="${r2(r * (0.6 + random() * 0.8))}" fill="${pick(palette, i + 1 + Math.floor(random() * palette.length))}" opacity="${r2(0.65 + random() * 0.35)}"/>`;
    }).join("");
    const g = Number(v.grain) || 0;
    return svgDoc(
      w,
      h,
      `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur}"/></filter>${grain(g)}</defs><rect width="${w}" height="${h}" fill="${ground}"/><g filter="url(#b)">${fields}</g>${g > 0 ? `<rect width="${w}" height="${h}" filter="url(#g)"/>` : ""}`
    );
  },
};

/** Rough lightness of a #rrggbb, for picking light and dark grounds. */
export const luma = (hex: string): number => {
  const n = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16) || 0;
  return 0.2126 * n(1) + 0.7152 * n(3) + 0.0722 * n(5);
};
