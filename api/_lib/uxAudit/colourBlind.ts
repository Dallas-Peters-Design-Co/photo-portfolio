import sharp from "sharp";
import type { Tile } from "./tiles.js";

/**
 * Screens as people with colour-blindness see them, for the accessibility
 * pass: the top of each screen, re-coloured for each of the three common
 * kinds, so "is meaning carried by colour alone" is checked against a
 * picture rather than guessed.
 *
 * Machado, Oliveira & Fernandes (2009) at full severity, applied to the
 * sRGB values directly: close enough to show what merges, which is the
 * question asked of it.
 */

type Matrix = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export const VISION_KINDS: { label: string; matrix: Matrix }[] = [
  {
    label: "protanopia (no red cones)",
    matrix: [
      [0.152_286, 1.052_583, -0.204_868],
      [0.114_503, 0.786_281, 0.099_216],
      [-0.003_882, -0.048_116, 1.051_998],
    ],
  },
  {
    label: "deuteranopia (no green cones, the most common)",
    matrix: [
      [0.367_322, 0.860_646, -0.227_968],
      [0.280_085, 0.672_501, 0.047_413],
      [-0.011_82, 0.042_94, 0.968_881],
    ],
  },
  {
    label: "tritanopia (no blue cones)",
    matrix: [
      [1.255_528, -0.076_749, -0.178_779],
      [-0.078_411, 0.930_809, 0.147_602],
      [0.004_733, 0.691_367, 0.3039],
    ],
  },
];

/** At most this many screens are re-coloured: three pictures each. */
const MAX_SCREENS = 6;

export interface VisionTile {
  data: string;
  label: string;
}

/** The top tile of the first screens, once per kind of colour-blindness. */
export const colourBlindTiles = async (
  byScreen: Map<string, Tile[]>
): Promise<VisionTile[]> => {
  const tops = [...byScreen.values()]
    .map((tiles) => tiles[0])
    .filter((tile): tile is Tile => Boolean(tile))
    .slice(0, MAX_SCREENS);
  const made = await Promise.all(
    tops.flatMap((tile) =>
      VISION_KINDS.map(async (kind) => {
        const jpeg = await sharp(Buffer.from(tile.data, "base64"))
          .recomb(kind.matrix)
          .jpeg({ quality: 75 })
          .toBuffer();
        return {
          data: jpeg.toString("base64"),
          label: `"${tile.screenTitle}" (top) as seen with ${kind.label}`,
        };
      })
    )
  );
  return made;
};
