import type { BrandKitDoc } from "../../../config/brandKit.js";
import { hexToOklch } from "../../lib/oklch";
import type { BoardItem } from "../../types";
import { isDrawingConfig, isTransparent } from "../drawing/drawing";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import { covers, rolesOf } from "./roles";

/**
 * A design checked against its brand kit, scored out of ten per category the
 * way a reviewer would: colours from the palette, type in the brand's fonts,
 * text big enough and contrasting enough at the ad's real size, nothing
 * crowding the edges or the logo, the logo present and legible, no off-brand
 * pictures, and copy short enough to read in a glance.
 *
 * Every finding names the layer it is about, so the editor can select it.
 */

export type CheckCategory =
  | "colour"
  | "copy"
  | "imagery"
  | "layout"
  | "logo"
  | "readability"
  | "typography";

export const CATEGORIES: { id: CheckCategory; label: string }[] = [
  { id: "copy", label: "Copy" },
  { id: "readability", label: "Readability" },
  { id: "layout", label: "Layout" },
  { id: "typography", label: "Typography" },
  { id: "colour", label: "Colour" },
  { id: "logo", label: "Logo" },
  { id: "imagery", label: "Imagery" },
];

export interface Finding {
  category: CheckCategory;
  layerId: string | null;
  message: string;
  severity: "error" | "warn";
}

export interface CheckResult {
  findings: Finding[];
  score: number;
  scores: Record<CheckCategory, number>;
}

const PENALTY = { error: 3, warn: 1.5 };

/* ---- colour maths ---- */

const channel = (hex: string, i: number) => {
  const v = Number.parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255;
  return v <= 0.040_45 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) =>
  0.2126 * channel(hex, 0) +
  0.7152 * channel(hex, 2) +
  0.0722 * channel(hex, 4);

export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

/** `over` painted at `alpha` on top of `under`, as hex. */
const blend = (over: string, under: string, alpha: number): string => {
  const mix = (i: number) => {
    const o = Number.parseInt(over.replace("#", "").slice(i, i + 2), 16);
    const u = Number.parseInt(under.replace("#", "").slice(i, i + 2), 16);
    return Math.round(o * alpha + u * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
};

const distance = (a: string, b: string): number => {
  const x = hexToOklch(a);
  const y = hexToOklch(b);
  if (!(x && y)) {
    return 1;
  }
  const ax = x.c * Math.cos((x.h * Math.PI) / 180);
  const ay = x.c * Math.sin((x.h * Math.PI) / 180);
  const bx = y.c * Math.cos((y.h * Math.PI) / 180);
  const by = y.c * Math.sin((y.h * Math.PI) / 180);
  return Math.hypot(x.l - y.l, ax - bx, ay - by);
};

/* ---- geometry ---- */

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const contains = (b: Box, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const grow = (b: Box, by: number): Box => ({
  height: b.height + by * 2,
  width: b.width + by * 2,
  x: b.x - by,
  y: b.y - by,
});

const solid = (hex: string) => hex.slice(0, 7);

/** The colour behind a point, from the shapes under a layer; null if a picture or nothing. */
const groundUnder = (layer: BoardItem, layers: BoardItem[]): string | null => {
  const p = centre(layer);
  const below = layers
    .filter((l) => l.z < layer.z && contains(l, p))
    .sort((a, b) => b.z - a.z);
  let colour: string | null = null;
  const stack: { alpha: number; fill: string }[] = [];
  for (const l of below) {
    if (l.kind === "drawing" && isDrawingConfig(l.config)) {
      const { fill } = l.config;
      if (!fill || isTransparent(fill)) {
        continue;
      }
      const alpha = l.config.opacity ?? 1;
      stack.push({ alpha, fill: solid(fill) });
      if (alpha >= 1) {
        colour = solid(fill);
        break;
      }
    } else if (currentImageUrl(l)) {
      return null;
    }
  }
  if (!colour) {
    return null;
  }
  // Paint the translucent shapes above the solid one, bottom up.
  return stack
    .slice(0, -1)
    .reverse()
    .reduce((acc, s) => blend(s.fill, acc, s.alpha), colour);
};

const SPACES = /\s+/;

const words = (s: string | null) =>
  (s ?? "").trim().split(SPACES).filter(Boolean).length;

interface Ctx {
  add: (
    category: CheckCategory,
    severity: Finding["severity"],
    message: string,
    layer?: BoardItem | null
  ) => void;
  doc: BrandKitDoc | null;
  exportScale: number;
  frame: Box;
  layers: BoardItem[];
  roles: ReturnType<typeof rolesOf>;
  texts: BoardItem[];
  u: number;
}

const checkCopy = (ctx: Ctx): void => {
  const { add, roles, texts } = ctx;
  if (roles.headline) {
    const n = words(roles.headline.body);
    if (n > 8) {
      add(
        "copy",
        "warn",
        `Headline is ${n} words; keep it to 8 or fewer.`,
        roles.headline
      );
    }
  } else {
    add("copy", "error", "No headline.");
  }
  const total = texts.reduce((sum, t) => sum + words(t.body), 0);
  if (total > 30) {
    add("copy", "warn", `${total} words in all; an ad reads best under 30.`);
  }
  if (!roles.cta) {
    add("copy", "warn", "No call to action button.");
  }
};

/** Font, size and contrast of one text layer. */
const checkText = (ctx: Ctx, t: BoardItem, brandRefs: Set<string>): void => {
  const { add, exportScale, layers, roles } = ctx;
  const family = t.textStyle?.family ?? null;
  if (brandRefs.size > 0 && !(family && brandRefs.has(family))) {
    add(
      "typography",
      "error",
      family
        ? "Set in a font that isn't one of the brand's."
        : "Set in the board's default font, not a brand font.",
      t
    );
  }
  const px = (t.fontSize ?? 22) * exportScale;
  if (px < 14) {
    add(
      "readability",
      "error",
      `Text is ${Math.round(px)}px at full size; too small to read.`,
      t
    );
  } else if (px < 18 && t !== roles.cta) {
    add(
      "readability",
      "warn",
      `Text is ${Math.round(px)}px at full size; 18px or more reads better.`,
      t
    );
  }
  const ink = t.textStyle?.color;
  if (!ink) {
    add(
      "readability",
      "warn",
      "Text has no colour set, so it follows the board's theme.",
      t
    );
    return;
  }
  const ground = groundUnder(t, layers);
  if (!ground) {
    return;
  }
  const ratio = contrast(solid(ink), ground);
  const large =
    px >= 24 || (px >= 18.66 && (t.textStyle?.weight ?? 400) >= 700);
  if (ratio < (large ? 3 : 4.5)) {
    add(
      "readability",
      "error",
      `Contrast is ${ratio.toFixed(1)}:1; needs ${large ? "3" : "4.5"}:1.`,
      t
    );
  }
};

const checkType = (ctx: Ctx): void => {
  const { add, doc, texts } = ctx;
  const brandRefs = new Set(
    (doc?.typefaces ?? [])
      .map((f) => f.ref)
      .filter((r): r is string => Boolean(r))
  );
  const families = new Set(texts.map((t) => t.textStyle?.family ?? "default"));
  for (const t of texts) {
    checkText(ctx, t, brandRefs);
  }
  if (families.size > 2) {
    add(
      "typography",
      "warn",
      `${families.size} typefaces in one ad; two at most.`
    );
  }
};

/** Every colour a layer paints with: fill, outline, text. */
const coloursOf = (l: BoardItem): string[] => {
  const colours: string[] = [];
  if (l.kind === "drawing" && isDrawingConfig(l.config)) {
    if (l.config.fill && !isTransparent(l.config.fill)) {
      colours.push(solid(l.config.fill));
    }
    if (l.config.strokeWidth > 0 && !isTransparent(l.config.stroke)) {
      colours.push(solid(l.config.stroke));
    }
  }
  if (l.textStyle?.color) {
    colours.push(solid(l.textStyle.color));
  }
  return colours;
};

const checkColour = (ctx: Ctx): void => {
  const { add, doc, layers } = ctx;
  const palette = (doc?.palette ?? []).map((p) => p.value);
  if (palette.length === 0) {
    return;
  }
  const allowed = [...palette, "#ffffff", "#000000"];
  for (const l of layers) {
    for (const c of coloursOf(l)) {
      if (!allowed.some((a) => distance(a, c) < 0.035)) {
        add(
          "colour",
          "warn",
          `${c.toUpperCase()} isn't in the brand palette.`,
          l
        );
      }
    }
  }
};

const tooClose = (l: Box, frame: Box, margin: number): boolean =>
  l.x - frame.x < margin ||
  l.y - frame.y < margin ||
  frame.x + frame.width - (l.x + l.width) < margin ||
  frame.y + frame.height - (l.y + l.height) < margin;

const checkLayout = (ctx: Ctx): void => {
  const { add, frame, layers, roles, texts, u } = ctx;
  const margin = u * 0.03;
  for (const l of layers) {
    if (covers(l, frame) || l === roles.background) {
      continue;
    }
    const outside =
      l.x < frame.x - 1 ||
      l.y < frame.y - 1 ||
      l.x + l.width > frame.x + frame.width + 1 ||
      l.y + l.height > frame.y + frame.height + 1;
    const isPictureLayer = l === roles.image;
    if (outside && !isPictureLayer) {
      add("layout", "warn", "Runs off the edge of the ad.", l);
    } else if (
      (texts.includes(l) || l === roles.logo) &&
      tooClose(l, frame, margin)
    ) {
      add("layout", "warn", "Too close to the edge; give it some margin.", l);
    }
  }
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i];
      const b = texts[j];
      if (a && b && overlaps(a, b)) {
        add("layout", "error", "Two text layers overlap.", b);
      }
    }
  }
};

const checkLogo = (ctx: Ctx): void => {
  const { add, doc, exportScale, frame, layers, roles } = ctx;
  const logoSpec = (doc?.logos ?? []).find(
    (l) => roles.logo && currentImageUrl(roles.logo) === l.url
  );
  if (roles.logo) {
    const { logo } = roles;
    const px = logo.width * exportScale;
    if (logoSpec && px < logoSpec.minWidth) {
      add(
        "logo",
        "error",
        `Logo is ${Math.round(px)}px wide; the kit's minimum is ${logoSpec.minWidth}px.`,
        logo
      );
    }
    const clear = grow(logo, (logoSpec?.clearSpace ?? 0.25) * logo.width);
    for (const l of layers) {
      if (
        l === logo ||
        l === roles.background ||
        l === roles.image ||
        covers(l, frame) ||
        l.z < logo.z
      ) {
        continue;
      }
      if (overlaps(l, clear)) {
        add("logo", "warn", "Something sits inside the logo's clear space.", l);
        break;
      }
    }
  } else if ((doc?.logos ?? []).length > 0) {
    add("logo", "error", "No logo on the ad.");
  }
};

const checkImagery = (ctx: Ctx): void => {
  const { add, doc, layers } = ctx;
  const off = new Set(doc?.offBrand ?? []);
  for (const l of layers) {
    const url = currentImageUrl(l);
    if (url && off.has(url)) {
      add(
        "imagery",
        "error",
        'This picture is in the kit\'s "Not this" set.',
        l
      );
    }
  }
};

export const checkFrame = (
  frame: Box,
  layers: BoardItem[],
  doc: BrandKitDoc | null,
  exportScale: number
): CheckResult => {
  const findings: Finding[] = [];
  const add = (
    category: CheckCategory,
    severity: Finding["severity"],
    message: string,
    layer: BoardItem | null = null
  ) =>
    findings.push({ category, layerId: layer?.id ?? null, message, severity });

  const roles = rolesOf(frame, layers, doc);
  const u = Math.min(frame.width, frame.height);
  const texts = layers.filter((l) => l.kind === "text" || l.kind === "note");

  const ctx: Ctx = { add, doc, exportScale, frame, layers, roles, texts, u };
  checkCopy(ctx);
  checkType(ctx);
  checkColour(ctx);
  checkLayout(ctx);
  checkLogo(ctx);
  checkImagery(ctx);

  const scores = Object.fromEntries(
    CATEGORIES.map(({ id }) => [
      id,
      Math.max(
        0,
        10 -
          findings
            .filter((f) => f.category === id)
            .reduce((sum, f) => sum + PENALTY[f.severity], 0)
      ),
    ])
  ) as Record<CheckCategory, number>;
  const values = Object.values(scores);
  const score =
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  return { findings, score, scores };
};
