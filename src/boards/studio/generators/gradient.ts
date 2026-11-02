import { esc, pick, r2, svgDoc } from "../rng";
import type { ImageTool, StudioValues } from "../types";

/**
 * Linear, radial and conic gradients from brand colours, with the CSS to
 * paste.
 */

/** The stops are the colours picked in the panel (see chosenColors.ts). */
const stopsOf = (_v: StudioValues, palette: string[]): string[] =>
  palette.length > 1
    ? palette
    : [palette[0] ?? "#000000", palette[0] ?? "#ffffff"];

/**
 * Conic has no SVG primitive, and fine wedges always seam when drawn as an
 * image, so it's painted with the canvas's own conic gradient and embedded.
 */
const conicImage = (w: number, h: number, colors: string[], angle: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  const g = ctx.createConicGradient(
    ((angle - 90) * Math.PI) / 180,
    w / 2,
    h / 2
  );
  const ring = [...colors, colors[0] as string];
  for (const [i, c] of ring.entries()) {
    g.addColorStop(i / (ring.length - 1), c);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return `<image width="${w}" height="${h}" href="${canvas.toDataURL("image/png")}"/>`;
};

export const gradientTool: ImageTool = {
  blurb: "Linear, radial and conic gradients in brand colours, with CSS.",
  css: (v, { palette }) => {
    const colors = stopsOf(v, palette).join(", ");
    const angle = Number(v.angle) || 0;
    if (v.kind === "radial") {
      return `background: radial-gradient(circle at center, ${colors});`;
    }
    if (v.kind === "conic") {
      return `background: conic-gradient(from ${angle}deg, ${colors}, ${pick(palette, 0)});`;
    }
    return `background: linear-gradient(${angle}deg, ${colors});`;
  },
  id: "gradient",
  kind: "image",
  name: "Gradient Builder",
  params: [
    {
      default: "linear",
      key: "kind",
      label: "Type",
      options: [
        { label: "Linear", value: "linear" },
        { label: "Radial", value: "radial" },
        { label: "Conic", value: "conic" },
      ],
      type: "select",
    },
    {
      default: 135,
      key: "angle",
      label: "Angle",
      max: 360,
      min: 0,
      type: "range",
    },
    { count: 3, key: "colors", label: "Colours", max: 8, type: "colors" },
  ],
  render: (v, { height: h, palette, width: w }) => {
    const colors = stopsOf(v, palette).map(esc);
    const angle = Number(v.angle) || 0;
    if (v.kind === "conic") {
      return svgDoc(w, h, conicImage(w, h, colors, angle));
    }
    const stops = colors
      .map(
        (c, i) =>
          `<stop offset="${r2((i / (colors.length - 1)) * 100)}%" stop-color="${c}"/>`
      )
      .join("");
    if (v.kind === "radial") {
      return svgDoc(
        w,
        h,
        `<defs><radialGradient id="r" cx="50%" cy="50%" r="70%">${stops}</radialGradient></defs><rect width="${w}" height="${h}" fill="url(#r)"/>`
      );
    }
    // CSS angles: 0deg points up, clockwise. Project onto the box like CSS does.
    const rad = (angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    const x1 = w / 2 - dx * half;
    const y1 = h / 2 - dy * half;
    const x2 = w / 2 + dx * half;
    const y2 = h / 2 + dy * half;
    return svgDoc(
      w,
      h,
      `<defs><linearGradient id="l" gradientUnits="userSpaceOnUse" x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}">${stops}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#l)"/>`
    );
  },
};
