import type { LogoEntry } from "../../../config/brandKit";
import { useActiveBrand } from "../brand/ActiveBrand";

/**
 * Whose post a social mock-up shows: the board's brand (the Brand panel's
 * choice, ActiveBrand.tsx) — its name, handle, website and logo — so a
 * preview reads as the real page rather than "Your Company" with a "Y".
 * With no brand chosen, or on a published board, the placeholders stay.
 */

export interface SocialBrand {
  /** "rolemodelsoftware", for @handles and Instagram names. */
  handle: string;
  initial: string;
  /** The logo to put in avatars and page logos, if the kit has one. */
  logoUrl: string | null;
  name: string;
  /** "rolemodelsoftware.com". */
  site: string;
}

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

export const useSocialBrand = (): SocialBrand => {
  const kit = useActiveBrand()?.kit;
  if (!kit) {
    return PLACEHOLDER;
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
