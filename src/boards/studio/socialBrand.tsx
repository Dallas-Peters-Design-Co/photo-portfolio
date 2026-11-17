import { createContext, useContext } from "react";
import type { LogoEntry } from "../../../config/brandKit";
import {
  cleanSocialBrand,
  type SocialBrand,
} from "../../../config/socialPreview";

export type { SocialBrand } from "../../../config/socialPreview";

import { useActiveBrand } from "../brand/ActiveBrand";

/**
 * Whose post a social mock-up shows: the board's brand (the Brand panel's
 * choice, ActiveBrand.tsx) — its name, handle, website and logo — so a
 * preview reads as the real page rather than "Your Company" with a "Y".
 * The brand chosen is only remembered in the designer's browser, so each
 * Social Preview node keeps a copy of it (config.brand, written by
 * SocialBrandSync): a visitor to the published board, who has no brand
 * chosen, sees that copy. With neither, the placeholders stay.
 */

const PLACEHOLDER: SocialBrand = {
  handle: "yourbrand",
  initial: "Y",
  logoUrl: null,
  name: "Your Brand",
  site: "yourbrand.com",
};

const NOT_HANDLE = /[^a-z0-9_]/g;
const WWW = /^www\./;
/** A logo labelled as the brand's mark or icon suits a small square best. */
const MARK = /\b(?:mark|icon|symbol|avatar|monogram|favicon)\b/i;
/** Light or reversed logos vanish on the avatars' white. */
const ON_DARK = /on[ -]?dark|white|reverse|knock/i;

const siteOf = (websites: string[]): string | null => {
  const [first] = websites;
  if (!first) {
    return null;
  }
  try {
    return new URL(first).hostname.replace(WWW, "");
  } catch {
    return first.replace(WWW, "");
  }
};

/** The kit's logo that reads best small on white. */
export const avatarLogo = (logos: LogoEntry[]): string | null => {
  const onLight = logos.filter((logo) => !ON_DARK.test(logo.label));
  const pick =
    onLight.find((logo) => MARK.test(logo.label)) ??
    onLight[0] ??
    logos.find((logo) => MARK.test(logo.label)) ??
    logos[0];
  return pick?.url ?? null;
};

/** A node's saved brand, or null when it has none worth showing. */
export const savedSocialBrand = cleanSocialBrand;

/** The brand saved on the Social Preview node being drawn, if any. */
export const SavedSocialBrand = createContext<SocialBrand | null>(null);

/** The board's chosen brand, as a mock-up shows it; null when none is chosen. */
export const useChosenSocialBrand = (): SocialBrand | null => {
  const kit = useActiveBrand()?.kit;
  if (!kit) {
    return null;
  }
  const handle = kit.name.toLowerCase().replace(NOT_HANDLE, "");
  return {
    handle: handle || PLACEHOLDER.handle,
    initial: kit.name.trim().charAt(0).toUpperCase() || PLACEHOLDER.initial,
    logoUrl: avatarLogo(kit.resolvedDoc.logos),
    name: kit.name,
    site: siteOf(kit.resolvedDoc.websites) ?? `${handle || "yourbrand"}.com`,
  };
};

/** The chosen brand, else the one saved on the node, else the placeholders. */
export const useSocialBrand = (): SocialBrand => {
  const chosen = useChosenSocialBrand();
  const saved = useContext(SavedSocialBrand);
  return chosen ?? saved ?? PLACEHOLDER;
};

/** The brand's logo, or its initial when it has none. */
export function BrandMark() {
  const { initial, logoUrl } = useSocialBrand();
  return logoUrl ? (
    <img
      alt=""
      className="social-mock__mark"
      decoding="async"
      height={64}
      src={logoUrl}
      width={64}
    />
  ) : (
    initial
  );
}
