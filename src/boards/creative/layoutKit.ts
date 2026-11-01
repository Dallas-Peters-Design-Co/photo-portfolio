import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../../../config/canvas";
import type { TextStyle } from "../../../config/textStyle";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import { inkOn } from "../../components/brandGuide/guideModel";
import type { BoardItem } from "../../types";
import type { DrawingConfig } from "../drawing/drawing";
import { newItemId } from "../io/newItemId";
import type { Box } from "./creativeModel";

/**
 * What every starter layout is built from (layouts.ts, bento.ts): the brand's
 * colours, faces and pictures, the copy, and a stack that lays items out one
 * after another in z order.
 */

export interface Copy {
  body: string;
  cta: string;
  headline: string;
}

export interface Brand {
  accent: string;
  bodyFont: string | null;
  headFont: string | null;
  image: string | null;
  /** Every on-brand picture, the frame's own first. */
  images: string[];
  ink: string;
  logo: string | null;
  paper: string;
}

export const font = (n: number) =>
  Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n)));

export const style = (
  family: string | null,
  color: string,
  weight: number,
  align: TextStyle["align"],
  lineHeight: number
): TextStyle => ({
  align,
  color,
  family,
  italic: null,
  letterSpacing: weight >= 600 ? -0.01 : null,
  lineHeight,
  transform: null,
  weight,
});

/** Lays items out one after another, assigning z in order. */
export class Stack {
  private z: number;
  readonly items: BoardItem[] = [];

  constructor(z: number) {
    this.z = z;
  }

  private push(item: Omit<BoardItem, "id" | "z">) {
    this.items.push({ ...item, id: newItemId(), z: this.z } as BoardItem);
    this.z += 1;
  }

  rect(box: Box, fill: string, radius = 0, opacity = 1) {
    const config: DrawingConfig = {
      fill,
      opacity,
      radius,
      stroke: "#00000000",
      strokeWidth: 0,
      tool: radius > 0 ? "rounded" : "rect",
    };
    this.push({
      ...BLANK_ITEM,
      ...round(box),
      config: config as unknown as Record<string, unknown>,
      kind: "drawing",
    });
  }

  image(box: Box, url: string, radius = 0) {
    this.push({
      ...BLANK_ITEM,
      ...round(box),
      config: radius > 0 ? { radius: Math.round(radius) } : null,
      imageUrl: url,
      kind: "reference",
      thumbUrl: url,
    });
  }

  text(box: Box, body: string, fontSize: number, textStyle: TextStyle) {
    this.push({
      ...BLANK_ITEM,
      ...round(box),
      body,
      fontSize: font(fontSize),
      kind: "text",
      textStyle,
    });
  }
}

export const round = (b: Box): Box => ({
  height: Math.round(b.height),
  width: Math.round(b.width),
  x: Math.round(b.x),
  y: Math.round(b.y),
});

/** Headline, body and button stacked in a box, from the top. */
export const copyBlock = (
  s: Stack,
  box: Box,
  copy: Copy,
  brand: Brand,
  ink: string,
  align: "center" | "left",
  u: number
) => {
  const head = Math.min(u * 0.1, box.width * 0.11);
  const bodySize = Math.max(head * 0.42, u * 0.032);
  const headBox = { ...box, height: head * 2.3 };
  s.text(
    headBox,
    copy.headline,
    head,
    style(brand.headFont, ink, 700, align, 1.05)
  );
  const bodyBox = {
    ...box,
    height: bodySize * 3.4,
    y: box.y + headBox.height + u * 0.02,
  };
  s.text(
    bodyBox,
    copy.body,
    bodySize,
    style(brand.bodyFont, ink, 400, align, 1.3)
  );
  const btnH = Math.max(u * 0.09, bodySize * 2.2);
  const btnW = Math.min(
    box.width,
    Math.max(u * 0.34, copy.cta.length * bodySize * 0.62 + btnH)
  );
  const btn = {
    height: btnH,
    width: btnW,
    x: align === "center" ? box.x + (box.width - btnW) / 2 : box.x,
    y: bodyBox.y + bodyBox.height + u * 0.03,
  };
  s.rect(btn, brand.accent, btnH / 2);
  const ctaInk = inkOn(brand.accent) === "dark" ? brand.ink : "#ffffff";
  const ctaSize = bodySize * 0.95;
  s.text(
    { ...btn, height: ctaSize * 1.6, y: btn.y + (btnH - ctaSize * 1.6) / 2 },
    copy.cta,
    ctaSize,
    style(brand.bodyFont, ctaInk, 600, "center", 1.2)
  );
};

export const logoAt = (
  s: Stack,
  brand: Brand,
  x: number,
  y: number,
  u: number
) => {
  if (brand.logo) {
    s.image({ height: u * 0.08, width: u * 0.22, x, y }, brand.logo);
  }
};

export interface Geo {
  brand: Brand;
  copy: Copy;
  frame: Box;
  m: number;
  s: Stack;
  u: number;
  wide: boolean;
}
