import type { BrandKitDoc } from "../../../config/brandKit.js";
import type { BoardItem } from "../../types";
import { isDrawingConfig, isFreehand } from "../drawing/drawing";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";

/**
 * What each layer of a design is for: headline, body, call to action (and
 * the button behind it), logo, hero image, background. Worked out from the
 * layers themselves so copy variants and the brand check work on any frame,
 * not only one built from a layout.
 */

export interface Roles {
  background: BoardItem | null;
  body: BoardItem | null;
  cta: BoardItem | null;
  ctaShape: BoardItem | null;
  headline: BoardItem | null;
  image: BoardItem | null;
  logo: BoardItem | null;
}

const area = (b: Box) => b.width * b.height;

const centreIn = (inner: Box, outer: Box) => {
  const cx = inner.x + inner.width / 2;
  const cy = inner.y + inner.height / 2;
  return (
    cx >= outer.x &&
    cx <= outer.x + outer.width &&
    cy >= outer.y &&
    cy <= outer.y + outer.height
  );
};

export const covers = (b: Box, frame: Box): boolean =>
  b.x <= frame.x + 1 &&
  b.y <= frame.y + 1 &&
  b.x + b.width >= frame.x + frame.width - 1 &&
  b.y + b.height >= frame.y + frame.height - 1;

const isShape = (item: BoardItem) =>
  item.kind === "drawing" &&
  isDrawingConfig(item.config) &&
  !isFreehand(item.config.tool);

const isText = (item: BoardItem) =>
  item.kind === "text" || item.kind === "note";

const isPicture = (item: BoardItem) =>
  (item.kind === "reference" || item.kind === "photo") &&
  Boolean(currentImageUrl(item));

export const rolesOf = (
  frame: Box,
  layers: BoardItem[],
  doc: BrandKitDoc | null = null
): Roles => {
  const logoUrls = new Set((doc?.logos ?? []).map((l) => l.url));
  const pictures = layers.filter(isPicture);
  const logo =
    pictures.find((p) => logoUrls.has(currentImageUrl(p) ?? "")) ??
    pictures.find((p) => area(p) < area(frame) * 0.06) ??
    null;
  const image =
    pictures.filter((p) => p !== logo).sort((a, b) => area(b) - area(a))[0] ??
    null;

  const shapes = layers.filter(isShape);
  const background = shapes.find((s) => covers(s, frame)) ?? null;
  const buttons = shapes.filter(
    (s) => s !== background && area(s) < area(frame) * 0.4
  );

  const texts = layers.filter(isText);
  let cta: BoardItem | null = null;
  let ctaShape: BoardItem | null = null;
  for (const text of texts) {
    const behind = buttons.find((s) => centreIn(text, s) && s.z < text.z);
    if (behind) {
      cta = text;
      ctaShape = behind;
      break;
    }
  }
  const rest = texts
    .filter((t) => t !== cta)
    .sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0));
  return {
    background,
    body: rest[1] ?? null,
    cta,
    ctaShape,
    headline: rest[0] ?? null,
    image,
    logo,
  };
};
