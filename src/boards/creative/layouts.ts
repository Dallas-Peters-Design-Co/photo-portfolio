import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  brandFaces,
  groupPalette,
  inkOn,
  paperAndInk,
} from "../../components/brandGuide/guideModel";
import type { BoardItem } from "../../types";
import { currentImageUrl } from "../itemOutput";
import { BENTO_BUILDERS, BENTO_LAYOUTS } from "./bento";
import type { Box } from "./creativeModel";
import {
  type Brand,
  type Copy,
  copyBlock,
  type Geo,
  logoAt,
  Stack,
} from "./layoutKit";
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
  ...BENTO_LAYOUTS,
] as const;

export type LayoutId = (typeof LAYOUTS)[number]["id"];

export const DEFAULT_COPY: Copy = {
  body: "One line on why it matters to the person reading.",
  cta: "Learn more",
  headline: "Say the one thing that matters",
};

export const brandFor = (doc: BrandKitDoc | null, roles: Roles): Brand => {
  const groups = groupPalette(doc?.palette ?? []);
  const { body, headline } = brandFaces(doc);
  const own = roles.image ? currentImageUrl(roles.image) : null;
  return {
    accent: groups.brand[0]?.value ?? "#1e3dff",
    bodyFont: body?.ref ?? null,
    headFont: headline?.ref ?? null,
    image: own ?? doc?.onBrand[0] ?? null,
    images: [...new Set([...(own ? [own] : []), ...(doc?.onBrand ?? [])])],
    ink: paperAndInk(doc?.palette ?? []).ink ?? "#0b0f1a",
    logo:
      (roles.logo ? currentImageUrl(roles.logo) : null) ??
      doc?.logos[0]?.url ??
      null,
    paper: paperAndInk(doc?.palette ?? []).paper ?? "#ffffff",
  };
};

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
  ...BENTO_BUILDERS,
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
