import type { BrandKitDoc } from "../../config/brandKit.js";
import { facesOf, familyOf } from "../../config/designMd.js";
import type { SiteFace, SiteTypography } from "../../config/siteType.js";
import { loadKit } from "./brandKitStore.js";
import { getSql } from "./db.js";

/**
 * The site's typography, read from the brand kit its theme names
 * (config/siteType.ts). Server-side only: the kit is private, and the public
 * settings carry just its faces and type scale.
 */

const faceOf = (
  entry: BrandKitDoc["typefaces"][number] | undefined
): SiteFace | null =>
  entry ? { family: familyOf(entry), ref: entry.ref } : null;

/** What a kit gives a site; null when it has neither faces nor a scale. */
export const typographyOf = (kit: {
  id: string;
  name: string;
  resolvedDoc: BrandKitDoc;
}): SiteTypography | null => {
  const doc = kit.resolvedDoc;
  const faces = facesOf(doc.typefaces);
  const styles = doc.typeScale?.styles ?? [];
  if (doc.typefaces.length === 0 && styles.length === 0) {
    return null;
  }
  return {
    body: faceOf(faces.body),
    headline: faceOf(faces.headline),
    kitId: kit.id,
    kitName: kit.name,
    styles,
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Null when no kit is named, it is gone, or it cannot be read just now. */
export const loadSiteTypography = async (
  brandKitId: string | null | undefined
): Promise<SiteTypography | null> => {
  if (!(brandKitId && UUID.test(brandKitId))) {
    return null;
  }
  try {
    const kit = await loadKit(getSql(), brandKitId);
    return kit ? typographyOf(kit) : null;
  } catch (e) {
    // Type from the theme's own fonts beats no site.
    console.error("[site typography]", e);
    return null;
  }
};
