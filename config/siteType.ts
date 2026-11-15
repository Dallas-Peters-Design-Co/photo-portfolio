import { fontRefStack, parseFontRef } from "./fontRef.js";
import type { TypeStyle } from "./typeScale.js";

/**
 * A site's typography, taken from a brand kit.
 *
 * The site names a kit (theme.brandKitId, chosen in Site settings or with
 * "Use on this site" in the Studio's Type & Spacing Scale). Its headline and
 * body faces and its type scale are then what the public pages are set in:
 * the faces replace the theme's display and sans fonts, and each text style
 * becomes a set of CSS variables the pages read —
 *
 *   --type-<name>-size / -weight / -leading / -tracking / -case
 *
 * for the names the scale uses (display, h1…h4, lead, body, small, label).
 * A page falls back to its own size when the scale has no such style, so a
 * site with no kit, or a kit with no scale, looks as it did.
 */

export interface SiteFace {
  family: string;
  /** Where it loads from (config/fontRef.ts); null for a typed name. */
  ref: string | null;
}

export interface SiteTypography {
  body: SiteFace | null;
  headline: SiteFace | null;
  kitId: string;
  kitName: string;
  styles: TypeStyle[];
}

const stackOf = (face: SiteFace | null): string | null => {
  if (!face) {
    return null;
  }
  const ref = parseFontRef(face.ref);
  return ref
    ? fontRefStack(ref)
    : `"${face.family}", ui-sans-serif, system-ui, sans-serif`;
};

/** The CSS variables a site's typography sets on the page's root. */
export const typographyVars = (
  typography: SiteTypography
): Record<string, string> => {
  const vars: Record<string, string> = {};
  const head = stackOf(typography.headline);
  const body = stackOf(typography.body);
  if (head) {
    vars["--font-display"] = head;
  }
  if (body) {
    vars["--font-sans"] = body;
  }
  for (const s of typography.styles) {
    const key = `--type-${s.name}`;
    vars[`${key}-size`] = `${s.size / 16}rem`;
    vars[`${key}-weight`] = String(s.weight);
    vars[`${key}-leading`] = String(s.lineHeight);
    vars[`${key}-tracking`] = `${s.tracking}em`;
    vars[`${key}-case`] = s.case;
  }
  return vars;
};
