import { unsplashApi } from "../../services/portfolioService";

/**
 * Real photographs to stand the mark on.
 *
 * The drawn grounds elsewhere on the sheet are honest about being diagrams.
 * This tile is not that question: a mark meets photographs constantly — a
 * header, a card, a slide, a post — and what matters is whether it survives a
 * surface it did not choose and cannot control. A flat rectangle cannot ask
 * that, because a flat rectangle has no texture to lose the mark in.
 *
 * Three moods rather than three pretty pictures, and the moods are the test:
 * dark, light, and one with colour flying around. A mark that reads on all
 * three is safe anywhere; one that vanishes on the light frame needs a plate
 * behind it, and the sheet should say so rather than flatter it.
 *
 * Unsplash is already wired here — a search endpoint with the download ping
 * their terms require — so this costs nothing and nobody has to licence a
 * stock library.
 */

export interface PhotoGround {
  creditName: string;
  imageUrl: string;
  label: string;
}

/**
 * The three searches, fixed rather than derived from the brand.
 *
 * Tempting to seed these from the kit's voice, and wrong: the point is a
 * surface the mark did *not* choose. A brand that says "warm, human, natural"
 * would fetch itself three flattering backgrounds and learn nothing.
 */
const MOODS: readonly { label: string; query: string }[] = [
  { label: "Dark", query: "dark water texture abstract" },
  { label: "Light", query: "soft natural light bokeh" },
  { label: "Colour", query: "prism light leak gradient" },
];

/**
 * One photograph per mood, or fewer.
 *
 * A mood that cannot be fetched is dropped rather than failing the tile: two
 * grounds still make the point, and no grounds is a tile that says so. Nothing
 * here should be able to take the rest of the sheet down.
 */
export const photoGrounds = async (): Promise<PhotoGround[]> => {
  const found = await Promise.all(
    MOODS.map(async (mood) => {
      try {
        const results = await unsplashApi.search(mood.query);
        const [photo] = results;
        if (!photo?.imageUrl) {
          return null;
        }
        /*
         * The download ping, which Unsplash's terms require whenever a photo
         * is actually used rather than merely listed. Deliberately not
         * awaited: crediting usage must not stand between the photograph and
         * the sheet.
         */
        unsplashApi.trackDownload(photo.downloadLocation);
        return {
          creditName: photo.creditName,
          imageUrl: photo.imageUrl,
          label: mood.label,
        };
      } catch {
        return null;
      }
    })
  );
  return found.filter((ground) => ground !== null);
};

/** Loaded so a canvas can draw them, dropping any that will not decode. */
export const loadGrounds = async (
  grounds: PhotoGround[]
): Promise<{ credit: string; image: HTMLImageElement; label: string }[]> => {
  const loaded = await Promise.all(
    grounds.map(
      (ground) =>
        new Promise<{
          credit: string;
          image: HTMLImageElement;
          label: string;
        } | null>((resolve) => {
          const image = new Image();
          // Read back into a canvas, so the request has to be a CORS one or
          // toBlob throws on a tainted canvas later.
          image.crossOrigin = "anonymous";
          image.onload = () =>
            resolve({
              credit: ground.creditName,
              image,
              label: ground.label,
            });
          image.onerror = () => resolve(null);
          image.src = ground.imageUrl;
        })
    )
  );
  return loaded.filter((entry) => entry !== null);
};

/** Kept so the tile can name the photographers, which the terms also require. */
export const creditLine = (grounds: { credit: string }[]): string =>
  grounds.length === 0
    ? ""
    : `Photographs: ${[...new Set(grounds.map((g) => g.credit))].join(", ")} / Unsplash`;
