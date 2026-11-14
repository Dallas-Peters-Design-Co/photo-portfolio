import type { ImageTool, StudioValues } from "../types";
import { numOr } from "./cellField";
import { faded } from "./mosaicFeather";
import { drawPrims, type Prim, primsDoc } from "./prims";
import { hex, rgb } from "./recolour";
import { fontFor, OUTLINE_FAMILIES, textPath, textWidth } from "./vectorType";

/**
 * Type Echo: a word repeated in steps, each copy moved on, squashed and
 * faded, like an echo or a long exposure, landing on one solid copy (which
 * can say something else: HOURS echoing into ASSETS). The letters are vector
 * outlines (vectorType.ts), so it goes in as an SVG.
 */

const mix = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
};

type Direction = "down" | "into" | "left" | "right" | "up";

interface Copy {
  alpha: number;
  colour: string;
  sx: number;
  sy: number;
  text: string;
  x: number;
  y: number;
}

interface Layout {
  H: number;
  size: number;
  textW: number;
  W: number;
}

/** Where a copy `i` steps along, squashed `k`, from the landing copy. */
const moved = (
  dir: Direction,
  base: [number, number],
  off: number,
  k: number,
  l: Layout
): [number, number, number, number] => {
  const [x, y] = base;
  if (dir === "down") {
    return [x, y + off, 1, k];
  }
  if (dir === "left") {
    return [x - off, y, k, 1];
  }
  if (dir === "right") {
    return [x + off, y, k, 1];
  }
  if (dir === "into") {
    const tx = x + (l.W / 2 - x - (l.textW * k) / 2) * (1 - k);
    return [tx, y - (y - l.H * 0.15) * (1 - k), k, k];
  }
  return [x, y - off, 1, k];
};

/** Each copy's place, squash, colour and opacity, farthest first. */
const copiesOf = (v: StudioValues, l: Layout): Copy[] => {
  const n = Math.max(1, Math.round(numOr(v.copies, 10)));
  const dir = String(v.direction || "up") as Direction;
  const step = (numOr(v.step, 35) / 100) * l.size;
  const squash = numOr(v.squash, 85) / 100;
  const far = numOr(v.fade, 15) / 100;
  const word = String(v.text ?? "HOURS");
  const last = String(v.landing ?? "").trim() || word;
  const margin = Math.min(l.W, l.H) * 0.05;
  const placeX: Record<string, number> = {
    center: (l.W - l.textW) / 2,
    left: margin,
    right: l.W - margin - l.textW,
  };
  const base: [number, number] = [
    placeX[String(v.align || "left")] ?? margin,
    dir === "down" ? margin + l.size * 0.75 : l.H - margin,
  ];
  const out: Copy[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const [x, y, sx, sy] = moved(dir, base, step * i, squash ** i, l);
    const near = String(v.echoNear || "#8fd6e8");
    out.push({
      alpha: i === 0 ? 1 : 1 - (1 - far) * t,
      colour:
        i === 0
          ? String(v.landColour || "#c5cf3a")
          : mix(near, String(v.echoFar || "#2f86ff"), t),
      sx,
      sy,
      text: i === 0 ? last : word,
      x,
      y,
    });
  }
  return out;
};

const shapesOf = (v: StudioValues, W: number, H: number): Prim[] => {
  const font = fontFor(String(v.font || "DM Sans"), Number(v.weight) || 800);
  if (!font) {
    return [];
  }
  const word = String(v.text ?? "HOURS");
  const last = String(v.landing ?? "").trim() || word;
  const wide = Math.max(
    textWidth(font, word, 100),
    textWidth(font, last, 100),
    1
  );
  const size = ((W * 0.9) / wide) * 100 * (numOr(v.scale, 100) / 100);
  const layout = { H, size, textW: textWidth(font, last, size), W };
  const outline = v.style === "outline";
  const paths = new Map<string, string>();
  const pathOf = (text: string) => {
    const had = paths.get(text) ?? textPath(font, text, size);
    paths.set(text, had);
    return had;
  };
  return copiesOf(v, layout).map((c, i, all) => {
    const colour = faded(c.colour, c.alpha);
    const echo = i < all.length - 1;
    const m = [c.sx, 0, 0, c.sy, c.x, c.y];
    if (outline && echo) {
      const sw = (size * numOr(v.outline, 2)) / 100 / Math.min(c.sx, c.sy);
      return { d: pathOf(c.text), m, stroke: colour, sw, t: "path" };
    }
    return { d: pathOf(c.text), fill: colour, m, t: "path" };
  });
};

const groundOf = (v: StudioValues) =>
  v.fill === false ? null : String(v.bg || "#0c2a2e");

export const typeEchoTool: ImageTool = {
  blurb:
    "A word repeated in steps, each copy moved, squashed and faded, landing on one solid copy that can say something else. Letters as outlines; goes in as an SVG.",
  draw: (g, v, ctx) =>
    drawPrims(g, shapesOf(v, ctx.width, ctx.height), ctx, groundOf(v)),
  id: "type-echo",
  kind: "image",
  looks: [
    { name: "Hours echo into assets", values: {} },
    {
      name: "Outline echo",
      values: { copies: 14, squash: 90, step: 22, style: "outline" },
    },
    { name: "Falling down", values: { direction: "down", landing: "" } },
    {
      name: "Into the distance",
      values: { copies: 24, direction: "into", squash: 88, step: 0 },
    },
    {
      name: "Condensed stack (Anton)",
      values: { copies: 12, font: "Anton", step: 30, weight: "400" },
    },
  ],
  name: "Type Echo",
  params: [
    { default: "HOURS", key: "text", label: "Word that echoes", type: "text" },
    {
      default: "ASSETS",
      key: "landing",
      label: "Word it lands on (blank: the same)",
      type: "text",
    },
    {
      default: "DM Sans",
      key: "font",
      label: "Font",
      options: OUTLINE_FAMILIES.map((f) => ({ label: f, value: f })),
      type: "select",
    },
    {
      default: "800",
      key: "weight",
      label: "Weight",
      options: [
        { label: "Regular", value: "400" },
        { label: "Bold", value: "700" },
        { label: "Extra bold", value: "800" },
        { label: "Black", value: "900" },
      ],
      type: "select",
    },
    {
      default: 100,
      key: "scale",
      label: "Text size",
      max: 140,
      min: 20,
      type: "range",
    },
    {
      default: "up",
      key: "direction",
      label: "Echoes go",
      options: [
        { label: "Up", value: "up" },
        { label: "Down", value: "down" },
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
        { label: "Into the distance", value: "into" },
      ],
      type: "select",
    },
    {
      default: 10,
      key: "copies",
      label: "Copies",
      max: 60,
      min: 1,
      type: "range",
    },
    {
      default: 35,
      key: "step",
      label: "Step (% of the type size)",
      max: 150,
      min: 0,
      type: "range",
    },
    {
      default: 85,
      key: "squash",
      label: "Each copy keeps (%)",
      max: 100,
      min: 40,
      type: "range",
    },
    {
      default: 15,
      key: "fade",
      label: "Farthest copy's opacity (%)",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: "fill",
      key: "style",
      label: "Echoes are",
      options: [
        { label: "Solid", value: "fill" },
        { label: "Outlines", value: "outline" },
      ],
      type: "select",
    },
    {
      default: 2,
      key: "outline",
      label: "Outline weight",
      max: 10,
      min: 0.5,
      step: 0.5,
      type: "range",
      when: (v) => v.style === "outline",
    },
    {
      default: "left",
      key: "align",
      label: "Place",
      options: [
        { label: "Left", value: "left" },
        { label: "Centre", value: "center" },
        { label: "Right", value: "right" },
      ],
      type: "select",
    },
    {
      default: "#c5cf3a",
      key: "landColour",
      label: "Landing word",
      type: "color",
    },
    {
      default: "#8fd6e8",
      key: "echoNear",
      label: "Nearest echo",
      type: "color",
    },
    {
      default: "#2f86ff",
      key: "echoFar",
      label: "Farthest echo",
      type: "color",
    },
    {
      default: true,
      key: "fill",
      label: "Fill the background",
      type: "checkbox",
    },
    {
      default: "#0c2a2e",
      key: "bg",
      label: "Background",
      type: "color",
      when: (v) => v.fill !== false,
    },
  ],
  render: (v, ctx) =>
    primsDoc(shapesOf(v, ctx.width, ctx.height), ctx, groundOf(v)),
  vector: true,
};
