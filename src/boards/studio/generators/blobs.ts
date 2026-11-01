import { pick, r2, rng, svgDoc } from "../rng";
import type { ImageTool } from "../types";

/**
 * Organic shapes, after MeltKit and blob makers: smooth closed blobs, a
 * melting slab with drips, or layered blobs. Curves are Catmull-Rom splines
 * turned into cubic Béziers, so the edges stay smooth at any size.
 */

type Pt = [number, number];

/** A smooth closed path through the points. */
export const smoothClosed = (pts: Pt[]): string => {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n] as Pt;
  let d = `M${r2(at(0)[0])} ${r2(at(0)[1])}`;
  for (let i = 0; i < n; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return `${d}Z`;
};

const blobPath = (
  cx: number,
  cy: number,
  r: number,
  points: number,
  wobble: number,
  random: () => number
): string =>
  smoothClosed(
    Array.from({ length: points }, (_, i) => {
      const a = (i / points) * Math.PI * 2;
      const k = 1 - wobble / 2 + random() * wobble;
      return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k] as Pt;
    })
  );

/** A slab hanging from the top edge, its bottom melting into drips. */
const meltPath = (
  w: number,
  h: number,
  drips: number,
  length: number,
  random: () => number
): string => {
  const base = h * 0.42;
  const step = w / drips;
  let d = `M0 0H${r2(w)}V${r2(base)}`;
  for (let i = drips - 1; i >= 0; i -= 1) {
    const x0 = i * step;
    const mid = x0 + step / 2;
    const dw = step * (0.32 + random() * 0.28);
    const dl = base + (h - base) * (length / 100) * (0.25 + random() * 0.75);
    d += `L${r2(mid + dw / 2 + step * 0.12)} ${r2(base)}C${r2(mid + dw / 2)} ${r2(base + 10)} ${r2(mid + dw / 2)} ${r2(dl - dw / 2)} ${r2(mid)} ${r2(dl)}C${r2(mid - dw / 2)} ${r2(dl - dw / 2)} ${r2(mid - dw / 2)} ${r2(base + 10)} ${r2(mid - dw / 2 - step * 0.12)} ${r2(base)}`;
  }
  return `${d}L0 ${r2(base)}Z`;
};

export const blobsTool: ImageTool = {
  blurb: "Smooth organic blobs, layered blobs, or a slab melting into drips.",
  id: "blobs",
  kind: "image",
  name: "Blobs & Melts",
  params: [
    {
      default: "blob",
      key: "kind",
      label: "Shape",
      options: [
        { label: "Blob", value: "blob" },
        { label: "Layered blobs", value: "layers" },
        { label: "Melt", value: "melt" },
      ],
      type: "select",
    },
    { key: "seed", label: "Seed", type: "seed" },
    {
      default: 8,
      key: "points",
      label: "Complexity",
      max: 16,
      min: 3,
      type: "range",
    },
    {
      default: 40,
      key: "wobble",
      label: "Wobble",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: 7,
      key: "drips",
      label: "Drips (melt)",
      max: 16,
      min: 2,
      type: "range",
    },
    {
      default: 70,
      key: "length",
      label: "Drip length",
      max: 100,
      min: 10,
      type: "range",
    },
    {
      default: true,
      key: "transparent",
      label: "Transparent background",
      type: "checkbox",
    },
  ],
  render: (v, { height: h, palette, width: w }) => {
    const random = rng(Number(v.seed) || 1);
    const ground = v.transparent
      ? ""
      : `<rect width="${w}" height="${h}" fill="${pick(palette, palette.length - 1)}"/>`;
    const points = Number(v.points) || 8;
    const wobble = (Number(v.wobble) || 0) / 100;
    if (v.kind === "melt") {
      return svgDoc(
        w,
        h,
        `${ground}<path d="${meltPath(w, h, Number(v.drips) || 7, Number(v.length) || 70, random)}" fill="${pick(palette, 0)}"/>`
      );
    }
    const size = Math.min(w, h);
    if (v.kind === "layers") {
      const layers = Array.from(
        { length: Math.min(palette.length, 4) },
        (_, i) => {
          const r = size * (0.42 - i * 0.08);
          return `<path d="${blobPath(w / 2 + (random() - 0.5) * size * 0.08, h / 2 + (random() - 0.5) * size * 0.08, r, points, wobble, random)}" fill="${pick(palette, i)}"/>`;
        }
      );
      return svgDoc(w, h, ground + layers.join(""));
    }
    return svgDoc(
      w,
      h,
      `${ground}<path d="${blobPath(w / 2, h / 2, size * 0.4, points, wobble, random)}" fill="${pick(palette, 0)}"/>`
    );
  },
};
