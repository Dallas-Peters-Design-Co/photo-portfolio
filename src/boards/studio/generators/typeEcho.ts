import { loadFontRef } from "../../../theme/remoteFonts";
import { esc, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numOr } from "./cellField";
import { FONTS } from "./flowText";
import { hex, rgb } from "./recolour";

/**
 * Type Echo: a word repeated in steps, each copy moved on, squashed and
 * faded, like an echo or a long exposure, landing on one solid copy (which
 * can say something else: HOURS echoing into ASSETS). Drawn with the real
 * font, so it goes in as a picture rather than an SVG.
 */

const fontOf = (v: StudioValues) => {
  const family = FONTS.includes(String(v.font)) ? String(v.font) : "DM Sans";
  return { family, weight: Number(v.weight) || 800 };
};

/** Asks for the face if it isn't loaded yet; the preview redraws when it is. */
const fontReady = (v: StudioValues) => {
  const { family, weight } = fontOf(v);
  loadFontRef(`g:${family}`);
  const css = `${weight} 100px "${family}"`;
  if (!document.fonts.check(css)) {
    void document.fonts.load(css);
    return false;
  }
  return true;
};

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

/** Each copy's place, squash, colour and opacity, farthest first. */
const copiesOf = (
  v: StudioValues,
  W: number,
  H: number,
  size: number,
  textW: number
): Copy[] => {
  const n = Math.max(1, Math.round(numOr(v.copies, 10)));
  const dir = String(v.direction || "up") as Direction;
  const step = (numOr(v.step, 35) / 100) * size;
  const squash = numOr(v.squash, 85) / 100;
  const far = numOr(v.fade, 15) / 100;
  const word = String(v.text ?? "HOURS");
  const last = String(v.landing ?? "").trim() || word;
  const margin = Math.min(W, H) * 0.05;
  const baseX =
    { center: (W - textW) / 2, left: margin, right: W - margin - textW }[
      String(v.align || "left")
    ] ?? margin;
  const baseY = dir === "down" ? margin + size * 0.75 : H - margin;
  const out: Copy[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const k = squash ** i;
    const off = step * i;
    const moves: Record<Direction, [number, number, number, number]> = {
      down: [baseX, baseY + off, 1, k],
      into: [
        baseX + (W / 2 - baseX - textW / 2) * (1 - k) * 0.9,
        baseY - (baseY - H * 0.15) * (1 - k),
        k,
        k,
      ],
      left: [baseX - off, baseY, k, 1],
      right: [baseX + off, baseY, k, 1],
      up: [baseX, baseY - off, 1, k],
    };
    const [x, y, sx, sy] = moves[dir] ?? moves.up;
    out.push({
      alpha: i === 0 ? 1 : 1 - (1 - far) * t,
      colour:
        i === 0
          ? String(v.landColour || "#c5cf3a")
          : mix(
              String(v.echoNear || "#8fd6e8"),
              String(v.echoFar || "#2f86ff"),
              t
            ),
      sx,
      sy,
      text: i === 0 ? last : word,
      x,
      y,
    });
  }
  return out;
};

/** The whole piece on a canvas `W` × `H` (the preview, or the full file). */
const paint = (
  g: CanvasRenderingContext2D,
  v: StudioValues,
  W: number,
  H: number
) => {
  g.clearRect(0, 0, W, H);
  if (v.fill !== false) {
    g.fillStyle = String(v.bg || "#0c2a2e");
    g.fillRect(0, 0, W, H);
  }
  fontReady(v);
  const { family, weight } = fontOf(v);
  const word = String(v.text ?? "HOURS");
  const last = String(v.landing ?? "").trim() || word;
  g.font = `${weight} 100px "${family}"`;
  const wide = Math.max(
    g.measureText(word).width,
    g.measureText(last).width,
    1
  );
  const size = ((W * 0.9) / wide) * 100 * (numOr(v.scale, 100) / 100);
  g.font = `${weight} ${size}px "${family}"`;
  const textW = g.measureText(last).width;
  const outline = v.style === "outline";
  for (const c of copiesOf(v, W, H, size, textW)) {
    g.save();
    g.globalAlpha = c.alpha;
    g.translate(c.x, c.y);
    g.scale(c.sx, c.sy);
    const echo = c.text !== last || c.alpha < 1;
    if (outline && echo) {
      g.strokeStyle = c.colour;
      g.lineWidth = (size * numOr(v.outline, 2)) / 100 / Math.min(c.sx, c.sy);
      g.strokeText(c.text, 0, 0);
    } else {
      g.fillStyle = c.colour;
      g.fillText(c.text, 0, 0);
    }
    g.restore();
  }
};

/** The full file: drawn on a canvas, kept within a size browsers handle. */
const MAX_SIDE = 5000;

export const typeEchoTool: ImageTool = {
  blurb:
    "A word repeated in steps, each copy moved, squashed and faded, landing on one solid copy that can say something else. Goes in as a picture.",
  draw: (g, v) => paint(g, v, g.canvas.width, g.canvas.height),
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
      name: "Sideways smear",
      values: {
        align: "left",
        copies: 18,
        direction: "right",
        squash: 92,
        step: 4,
      },
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
      options: FONTS.map((f) => ({ label: f, value: f })),
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
  render: (v: StudioValues, ctx: RenderContext) => {
    const k = Math.min(1, MAX_SIDE / Math.max(ctx.width, ctx.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(ctx.width * k);
    canvas.height = Math.round(ctx.height * k);
    const g = canvas.getContext("2d");
    if (g) {
      paint(g, v, canvas.width, canvas.height);
    }
    return svgDoc(
      ctx.width,
      ctx.height,
      `<image href="${esc(canvas.toDataURL("image/png"))}" x="0" y="0" width="${ctx.width}" height="${ctx.height}" preserveAspectRatio="none"/>`
    );
  },
  vector: false,
};
