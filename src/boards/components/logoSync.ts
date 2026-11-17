import type { LogoEntry } from "../../../config/brandKit.js";
import { brandKitsApi } from "../../services/brandKitService";
import { portfolioService } from "../../services/portfolioService";
import { renderCreative } from "../creative/exportPng";
import { withTextGhosts } from "../creative/textGhosts";
import { withDpi } from "../io/pngDensity";
import { type BrandComponent, expandInstance, newInstance } from "./model";

/**
 * A brand kit logo that follows a canvas component (LogoEntry.componentId).
 *
 * Every place a logo is used (the guide, proofs, boards, emails, the docs)
 * reads its picture, so the link is kept by drawing the component again
 * whenever it is saved and putting the new picture in the logo's place.
 * Drawn at twice its size on a clear ground, as a mark should be.
 */

const DENSITY = 2;

/** The component drawn on its own, transparent around it. */
export const renderComponentPng = async (
  component: BrandComponent
): Promise<Blob> => {
  const instance = newInstance(component, { x: 0, y: 0 }, []);
  const layers = expandInstance(instance, component);
  const box = { height: component.height, width: component.width, x: 0, y: 0 };
  const png = await withTextGhosts(layers, (textElementFor) =>
    renderCreative(box, layers, component.width * DENSITY, textElementFor)
  );
  return await withDpi(png, 72 * DENSITY);
};

/** The component drawn and uploaded: the url a linked logo shows. */
export const componentLogoUrl = async (
  component: BrandComponent
): Promise<string> =>
  (
    await portfolioService.uploadImageFile(
      new File(
        [await renderComponentPng(component)],
        `${component.name || "logo"}.png`,
        { type: "image/png" }
      ),
      undefined,
      "brand-kits/logos"
    )
  ).url;

/** A logo linked to this component, pointed at its new picture. */
export const relinked = (
  logos: LogoEntry[],
  componentId: string,
  url: string
): LogoEntry[] =>
  logos.map((logo) =>
    logo.componentId === componentId ? { ...logo, url } : logo
  );

/**
 * After a component is saved: every logo in its kit that follows it gets the
 * new drawing, saved as a new version of the kit. Answers how many changed.
 */
export const syncKitLogos = async (
  component: BrandComponent
): Promise<number> => {
  const kit = await brandKitsApi.get(component.kitId);
  const linked = kit.doc.logos.filter((l) => l.componentId === component.id);
  if (linked.length === 0) {
    return 0;
  }
  const url = await componentLogoUrl(component);
  await brandKitsApi.save(kit.id, {
    ...kit.doc,
    logos: relinked(kit.doc.logos, component.id, url),
  });
  return linked.length;
};
