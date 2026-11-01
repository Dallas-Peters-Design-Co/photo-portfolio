import type { BrandKitDoc } from "../../../config/brandKit.js";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../../../config/canvas";
import type { TextStyle } from "../../../config/textStyle";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import {
  brandFaces,
  groupPalette,
  inkOn,
} from "../../components/brandGuide/guideModel";
import type { BoardItem } from "../../types";
import type { DrawingConfig } from "../drawing/drawing";
import { newItemId } from "../io/newItemId";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import type { Roles } from "./roles";

/**
 * Starter layouts for an ad, built from the brand: its colours, its fonts,
 * its logo, its pictures, and whatever copy and image the frame already has.
 * Every size is laid out in proportion to the frame, and wide frames split
 * left/right where tall ones split top/bottom, so one layout reads at any of
 * the ad sizes.
 */

export const LAYOUTS = [
  { id: "split", label: "Split · image + copy" },
  { id: "fullbleed", label: "Full-bleed image" },
  { id: "centered", label: "Centred type" },
  { id: "block", label: "Colour block" },
] as const;

export type LayoutId = (typeof LAYOUTS)[number]["id"];

export interface Copy {
  body: string;
  cta: string;
  headline: string;
}

export const DEFAULT_COPY: Copy = {
  body: "One line on why it matters to the person reading.",
  cta: "Learn more",
  headline: "Say the one thing that matters",
};

interface Brand {
  accent: string;
  bodyFont: string | null;
  headFont: string | null;
  image: string | null;
  ink: string;
  logo: string | null;
  paper: string;
}

export const brandFor = (doc: BrandKitDoc | null, roles: Roles): Brand => {
  const groups = groupPalette(doc?.palette ?? []);
  const { body, headline } = brandFaces(doc);
  return {
    accent: groups.brand[0]?.value ?? "#1e3dff",
    bodyFont: body?.ref ?? null,
    headFont: headline?.ref ?? null,
    image:
      (roles.image ? currentImageUrl(roles.image) : null) ??
      doc?.onBrand[0] ??
      null,
    ink: groups.neutral.at(-1)?.value ?? "#0b0f1a",
    logo:
      (roles.logo ? currentImageUrl(roles.logo) : null) ??
      doc?.logos[0]?.url ??
      null,
    paper: groups.neutral[0]?.value ?? "#ffffff",
  };
};

const font = (n: number) =>
  Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n)));

const style = (
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
class Stack {
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

  image(box: Box, url: string) {
    this.push({
      ...BLANK_ITEM,
      ...round(box),
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

const round = (b: Box): Box => ({
  height: Math.round(b.height),
  width: Math.round(b.width),
  x: Math.round(b.x),
  y: Math.round(b.y),
});

/** Headline, body and button stacked in a box, from the top. */
const copyBlock = (
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

const logoAt = (s: Stack, brand: Brand, x: number, y: number, u: number) => {
  if (brand.logo) {
    s.image({ height: u * 0.08, width: u * 0.22, x, y }, brand.logo);
  }
};

interface Geo {
  brand: Brand;
  copy: Copy;
  frame: Box;
  m: number;
  s: Stack;
  u: number;
  wide: boolean;
}

const splitLayout = ({ brand, copy, frame, m, s, u, wide }: Geo): void => {
  const full = { ...frame };
  s.rect(full, brand.paper);
  const imgBox = wide
    ? { ...frame, width: frame.width * 0.48 }
    : { ...frame, height: frame.height * 0.5 };
  if (brand.image) {
    s.image(imgBox, brand.image);
  } else {
    s.rect(imgBox, brand.accent, 0, 0.18);
  }
  const copyBox = wide
    ? {
        height: frame.height - m * 2,
        width: frame.width * 0.52 - m * 2,
        x: frame.x + frame.width * 0.48 + m,
        y: frame.y + m * 1.6 + u * 0.12,
      }
    : {
        height: frame.height * 0.5 - m * 2,
        width: frame.width - m * 2,
        x: frame.x + m,
        y: frame.y + frame.height * 0.5 + m * 1.4 + u * 0.12,
      };
  logoAt(s, brand, copyBox.x, copyBox.y - u * 0.17, u);
  copyBlock(s, copyBox, copy, brand, brand.ink, "left", u);
};

const fullbleedLayout = ({ brand, copy, frame, m, s, u }: Geo): void => {
  const full = { ...frame };
  if (brand.image) {
    s.image(full, brand.image);
  } else {
    s.rect(full, brand.accent);
  }
  const scrim = {
    ...frame,
    height: frame.height * 0.55,
    y: frame.y + frame.height * 0.45,
  };
  s.rect(scrim, brand.ink, 0, 0.55);
  logoAt(s, brand, frame.x + m, frame.y + m, u);
  const copyBox = {
    height: scrim.height - m,
    width: frame.width - m * 2,
    x: frame.x + m,
    y: scrim.y + m * 0.6,
  };
  copyBlock(s, copyBox, copy, brand, "#ffffff", "left", u);
};

const centeredLayout = ({ brand, copy, frame, m, s, u }: Geo): void => {
  const full = { ...frame };
  s.rect(full, brand.accent);
  const ink = inkOn(brand.accent) === "dark" ? brand.ink : "#ffffff";
  const ctaBrand = {
    ...brand,
    accent: ink === "#ffffff" ? brand.paper : brand.ink,
  };
  logoAt(s, brand, frame.x + (frame.width - u * 0.22) / 2, frame.y + m, u);
  const copyBox = {
    height: frame.height * 0.6,
    width: frame.width - m * 2,
    x: frame.x + m,
    y: frame.y + frame.height * 0.3,
  };
  copyBlock(s, copyBox, copy, ctaBrand, ink, "center", u);
};

const blockLayout = ({ brand, copy, frame, m, s, u, wide }: Geo): void => {
  const full = { ...frame };
  s.rect(full, brand.paper);
  const block = wide
    ? { ...frame, width: frame.width * 0.42 }
    : { ...frame, height: frame.height * 0.42 };
  s.rect(block, brand.accent);
  if (brand.image) {
    const pic = wide
      ? {
          height: frame.height - m * 2,
          width: frame.width * 0.58 - m * 2,
          x: frame.x + frame.width * 0.42 + m,
          y: frame.y + m,
        }
      : {
          height: frame.height * 0.58 - m * 2,
          width: frame.width - m * 2,
          x: frame.x + m,
          y: frame.y + frame.height * 0.42 + m,
        };
    s.image(pic, brand.image);
  }
  const ink = inkOn(brand.accent) === "dark" ? brand.ink : "#ffffff";
  const ctaBrand = {
    ...brand,
    accent: ink === "#ffffff" ? brand.paper : brand.ink,
  };
  logoAt(s, brand, block.x + m, block.y + m, u);
  const copyBox = {
    height: block.height - m * 2,
    width: block.width - m * 2,
    x: block.x + m,
    y: block.y + m + u * 0.17,
  };
  copyBlock(s, copyBox, copy, ctaBrand, ink, "left", u);
};

const BUILDERS: Record<LayoutId, (g: Geo) => void> = {
  block: blockLayout,
  centered: centeredLayout,
  fullbleed: fullbleedLayout,
  split: splitLayout,
};

export const buildLayout = (
  id: LayoutId,
  frame: Box,
  z: number,
  copy: Copy,
  brand: Brand
): BoardItem[] => {
  const s = new Stack(z);
  const u = Math.min(frame.width, frame.height);
  BUILDERS[id]({
    brand,
    copy,
    frame,
    m: u * 0.07,
    s,
    u,
    wide: frame.width / frame.height > 1.25,
  });
  return s.items;
};

/** The copy a frame already carries, so a new layout keeps it. */
export const copyOf = (roles: Roles): Copy => ({
  body: roles.body?.body?.trim() || DEFAULT_COPY.body,
  cta: roles.cta?.body?.trim() || DEFAULT_COPY.cta,
  headline: roles.headline?.body?.trim() || DEFAULT_COPY.headline,
});
