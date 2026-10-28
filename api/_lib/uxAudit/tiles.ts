import sharp from "sharp";
import { hostMatches } from "../httpUrl.js";

/**
 * A screenshot cut into pieces Claude can read.
 *
 * A capture is a full page at twice its CSS width — 2880 by up to 12,000
 * pixels for a desktop screen. Sent whole, the API refuses it past 8000px on
 * a side, and below that shrinks it until body text is a grey smear. So each
 * screen is scaled to a readable width and cut top to bottom into tiles, and
 * every tile carries where on its screen it sits, so a finding placed on a
 * tile can be put back on the screen as a pin.
 */

export interface TileSource {
  id: string;
  title: string;
  url: string;
  viewport: "desktop" | "mobile";
}

export interface Tile {
  bottom: number;
  /** Base64 JPEG, ready for an image block. */
  data: string;
  /** "T1", "T2"… — what the model names when it places a finding. */
  label: string;
  screenId: string;
  screenTitle: string;
  /** The slice of the screen this tile covers, as fractions of its height. */
  top: number;
}

/** Wide enough to read a 14px body line at desktop; half that for a phone. */
const WIDTHS = { desktop: 1000, mobile: 500 } as const;
const TILE_HEIGHT = 1300;
/** Twenty-four tiles is a long site; past it the cost outruns the insight. */
export const MAX_TILES = 24;
const FETCH_TIMEOUT_MS = 30_000;

/** Only pictures this app stored: the server will not fetch anywhere else. */
const BLOB_HOSTS = ["blob.vercel-storage.com"];

export const isStoredImage = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" && hostMatches(parsed.hostname, BLOB_HOSTS)
    );
  } catch {
    return false;
  }
};

const download = async (url: string): Promise<Buffer> => {
  if (!isStoredImage(url)) {
    throw new Error("Screens must use pictures stored by this site");
  }
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Could not read a screenshot (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
};

const tilesOf = async (source: TileSource): Promise<Omit<Tile, "label">[]> => {
  const { data, info } = await sharp(await download(source.url))
    .resize({ width: WIDTHS[source.viewport], withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  const tops: number[] = [];
  for (let top = 0; top < info.height; top += TILE_HEIGHT) {
    tops.push(top);
  }
  return Promise.all(
    tops.map(async (top) => {
      const height = Math.min(TILE_HEIGHT, info.height - top);
      const jpeg = await sharp(data)
        .extract({ height, left: 0, top, width: info.width })
        .jpeg({ quality: 80 })
        .toBuffer();
      return {
        bottom: (top + height) / info.height,
        data: jpeg.toString("base64"),
        screenId: source.id,
        screenTitle: source.title,
        top: top / info.height,
      };
    })
  );
};

/**
 * Every screen as tiles, in screen order, labelled T1 onward.
 *
 * Past MAX_TILES the bottoms of the longest screens are dropped rather than
 * a whole screen, so every screen is still seen from the top.
 */
export const tileScreens = async (sources: TileSource[]): Promise<Tile[]> => {
  const perScreen = await Promise.all(sources.map(tilesOf));
  const kept: Omit<Tile, "label">[][] = perScreen.map(() => []);
  let total = 0;
  for (let row = 0; total < MAX_TILES; row += 1) {
    let added = false;
    for (const [i, tiles] of perScreen.entries()) {
      const tile = tiles[row];
      if (tile && total < MAX_TILES) {
        kept[i]?.push(tile);
        total += 1;
        added = true;
      }
    }
    if (!added) {
      break;
    }
  }
  return kept.flat().map((tile, i) => ({ ...tile, label: `T${i + 1}` }));
};

/** A point on a tile, as a point on the tile's screen. */
export const toScreenPoint = (
  tile: Pick<Tile, "bottom" | "top">,
  x: number,
  y: number
): { x: number; y: number } => ({
  x,
  y: tile.top + y * (tile.bottom - tile.top),
});
