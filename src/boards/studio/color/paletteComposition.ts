import { inkOn } from "../../../components/brandGuide/guideModel";
import { Stack, style } from "../../creative/layoutKit";
import type { StudioComposition } from "../composition";

/**
 * A palette placed on the board as vector swatches: one rounded block per
 * colour, filled with it, and its role and hex under it as live text. Shapes
 * and type, not a picture, so a swatch can be recoloured, resized, copied
 * into a design, and exported sharp at any size.
 */

const SWATCH = 200;
const GAP = 24;
const PAD = 40;
const LABEL = 64;
const RADIUS = 16;
const PAPER = "#ffffff";
const INK = "#111111";
const MUTED = "#6b6b6b";

export const paletteComposition = (
  colors: string[],
  roles: string[] = []
): StudioComposition => {
  const s = new Stack(1);
  const width = PAD * 2 + colors.length * SWATCH + (colors.length - 1) * GAP;
  const height = PAD * 2 + SWATCH + LABEL;
  s.rect({ height, width, x: 0, y: 0 }, PAPER);
  colors.forEach((color, i) => {
    const x = PAD + i * (SWATCH + GAP);
    s.rect({ height: SWATCH, width: SWATCH, x, y: PAD }, color, RADIUS);
    const hex = color.toUpperCase();
    const role = roles[i]?.trim();
    s.text(
      { height: 28, width: SWATCH, x, y: PAD + SWATCH + 12 },
      role || hex,
      20,
      style(null, INK, 600, "left", 1.2)
    );
    if (role) {
      s.text(
        { height: 24, width: SWATCH, x, y: PAD + SWATCH + 40 },
        hex,
        16,
        style(null, MUTED, 400, "left", 1.2)
      );
    }
    // The hex on the swatch too, in whichever ink reads on it.
    s.text(
      { height: 24, width: SWATCH - 32, x: x + 16, y: PAD + SWATCH - 40 },
      hex,
      14,
      style(null, inkOn(color) === "dark" ? INK : PAPER, 500, "left", 1.2)
    );
  });
  return { height, items: s.items, title: "Palette", width };
};
