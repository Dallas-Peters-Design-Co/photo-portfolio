import type { TypeScale, TypeStyle } from "../../../../config/typeScale.js";

/**
 * The type scale as a PNG specimen for the board: each style's name and specs
 * on the left, a line set in it on the right.
 *
 * Drawn on a canvas rather than as an SVG image, because an SVG drawn as an
 * image can't reach web fonts, and a specimen in a fallback face is worse
 * than none. The faces are loaded into the document first.
 */

const WIDTH = 2000;
const PAD = 80;
const GUTTER = 360;

const applyCase = (text: string, c: TypeStyle["case"]) => {
  if (c === "uppercase") {
    return text.toUpperCase();
  }
  if (c === "lowercase") {
    return text.toLowerCase();
  }
  if (c === "capitalize") {
    return text.replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return text;
};

const fontOf = (s: TypeStyle, family: string, size = s.size) =>
  `${s.weight} ${size}px ${family}`;

export const specimenPng = async (
  scale: TypeScale,
  familyFor: (face: TypeStyle["face"]) => string | undefined,
  title: string
): Promise<Blob> => {
  const family = (s: TypeStyle) => familyFor(s.face) ?? "system-ui";
  await Promise.all(
    scale.styles.map((s) =>
      document.fonts.load(fontOf(s, family(s), 32)).catch(() => [])
    )
  );
  const rows = scale.styles.map((s) => {
    const size = Math.min(s.size * 1.5, 220);
    return { h: Math.max(size * s.lineHeight, 60) + 36, s, size };
  });
  const height = PAD * 2 + 90 + rows.reduce((n, r) => n + r.h, 0);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("This browser can't draw the specimen");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "#111111";
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(`${title} type scale`, PAD, PAD + 28);
  let y = PAD + 90;
  for (const { h, s, size } of rows) {
    ctx.fillStyle = "#777777";
    ctx.font = "600 22px ui-monospace, monospace";
    ctx.letterSpacing = "0px";
    ctx.fillText(s.name, PAD, y + 30);
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(
      `${s.size}/${s.lineHeight} · ${s.weight}${s.tracking ? ` · ${s.tracking}em` : ""}`,
      PAD,
      y + 60
    );
    ctx.fillStyle = "#111111";
    ctx.font = fontOf(s, family(s), size);
    ctx.letterSpacing = `${s.tracking * size}px`;
    const text = applyCase(
      s.face === "headline"
        ? "The quick brown fox"
        : "Sphinx of black quartz, judge my vow",
      s.case
    );
    ctx.fillText(text, PAD + GUTTER, y + size * 0.9, WIDTH - PAD * 2 - GUTTER);
    y += h;
  }
  return await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("The specimen came out empty")),
      "image/png"
    )
  );
};
