import { inkOn } from "../../components/brandGuide/guideModel";
import type { Box } from "./creativeModel";
import {
  type Brand,
  type Copy,
  type Geo,
  type Stack,
  style,
} from "./layoutKit";

/**
 * Bento layouts: the frame as a grid of rounded tiles, after the bento boxes
 * product sites use. One big picture, a tile of copy, the logo, the call to
 * action and a second picture or a colour, on the brand's paper. The grid
 * changes with the frame's shape so it reads at every ad size.
 */

export const BENTO_LAYOUTS = [
  { id: "bento", label: "Bento · picture led" },
  { id: "bento-copy", label: "Bento · copy led" },
] as const;

type Role = "copy" | "cta" | "image" | "image2" | "logo" | "tint";
/** Column, row, columns spanned, rows spanned, what goes in it. */
type Tile = [number, number, number, number, Role];

interface Grid {
  cols: number;
  rows: number;
  tiles: Tile[];
}

const GRIDS: Record<
  "square" | "tall" | "wide",
  Record<"copy" | "image", Grid>
> = {
  square: {
    copy: {
      cols: 3,
      rows: 3,
      tiles: [
        [0, 0, 2, 1, "copy"],
        [2, 0, 1, 2, "image"],
        [0, 1, 1, 1, "tint"],
        [1, 1, 1, 1, "image2"],
        [0, 2, 1, 1, "logo"],
        [1, 2, 2, 1, "cta"],
      ],
    },
    image: {
      cols: 3,
      rows: 3,
      tiles: [
        [0, 0, 2, 2, "image"],
        [2, 0, 1, 1, "logo"],
        [2, 1, 1, 1, "image2"],
        [0, 2, 2, 1, "copy"],
        [2, 2, 1, 1, "cta"],
      ],
    },
  },
  tall: {
    copy: {
      cols: 2,
      rows: 4,
      tiles: [
        [0, 0, 2, 1, "copy"],
        [0, 1, 1, 2, "image"],
        [1, 1, 1, 1, "image2"],
        [1, 2, 1, 1, "tint"],
        [0, 3, 1, 1, "logo"],
        [1, 3, 1, 1, "cta"],
      ],
    },
    image: {
      cols: 2,
      rows: 4,
      tiles: [
        [0, 0, 2, 2, "image"],
        [0, 2, 2, 1, "copy"],
        [0, 3, 1, 1, "logo"],
        [1, 3, 1, 1, "cta"],
      ],
    },
  },
  wide: {
    copy: {
      cols: 4,
      rows: 2,
      tiles: [
        [0, 0, 2, 2, "copy"],
        [2, 0, 1, 2, "image"],
        [3, 0, 1, 1, "logo"],
        [3, 1, 1, 1, "cta"],
      ],
    },
    image: {
      cols: 4,
      rows: 2,
      tiles: [
        [0, 0, 2, 2, "image"],
        [2, 0, 2, 1, "copy"],
        [2, 1, 1, 1, "logo"],
        [3, 1, 1, 1, "cta"],
      ],
    },
  },
};

const shapeOf = (frame: Box): keyof typeof GRIDS => {
  const ratio = frame.width / frame.height;
  if (ratio > 1.25) {
    return "wide";
  }
  return ratio < 0.8 ? "tall" : "square";
};

interface Cell {
  box: Box;
  brand: Brand;
  copy: Copy;
  r: number;
  s: Stack;
  u: number;
}

const inkFor = (ground: string, brand: Brand) =>
  inkOn(ground) === "dark" ? brand.ink : "#ffffff";

const copyTile = ({ box, brand, copy, r, s, u }: Cell) => {
  s.rect(box, brand.ink, r, 0.06);
  const pad = u * 0.045;
  const inner = {
    height: box.height - pad * 2,
    width: box.width - pad * 2,
    x: box.x + pad,
    y: box.y + pad,
  };
  const head = Math.min(inner.height * 0.24, inner.width * 0.1, u * 0.09);
  const body = Math.max(head * 0.45, u * 0.026);
  const headBox = { ...inner, height: head * 2.3 };
  s.text(
    headBox,
    copy.headline,
    head,
    style(brand.headFont, brand.ink, 700, "left", 1.05)
  );
  s.text(
    { ...inner, height: body * 3.4, y: inner.y + headBox.height + u * 0.015 },
    copy.body,
    body,
    style(brand.bodyFont, brand.ink, 400, "left", 1.3)
  );
};

const ctaTile = ({ box, brand, copy, r, s, u }: Cell) => {
  s.rect(box, brand.accent, r);
  const size = Math.min(box.height * 0.2, u * 0.045);
  const pad = u * 0.045;
  s.text(
    {
      height: size * 1.6,
      width: box.width - pad * 2,
      x: box.x + pad,
      y: box.y + box.height - pad - size * 1.6,
    },
    copy.cta,
    size,
    style(brand.bodyFont, inkFor(brand.accent, brand), 600, "left", 1.2)
  );
};

const logoTile = ({ box, brand, r, s, u }: Cell) => {
  if (!brand.logo) {
    // No logo in the kit: a block of the brand's ink holds the corner.
    s.rect(box, brand.ink, r);
    return;
  }
  s.rect(box, brand.ink, r, 0.06);
  const w = Math.min(box.width * 0.7, u * 0.26);
  const h = Math.min(box.height * 0.4, w * 0.36);
  s.image(
    {
      height: h,
      width: w,
      x: box.x + (box.width - w) / 2,
      y: box.y + (box.height - h) / 2,
    },
    brand.logo
  );
};

const picture = (
  cell: Cell,
  url: string | undefined,
  fallback: string,
  opacity: number
) => {
  if (url) {
    cell.s.image(cell.box, url, cell.r);
  } else {
    cell.s.rect(cell.box, fallback, cell.r, opacity);
  }
};

const TILES: Record<Role, (cell: Cell) => void> = {
  copy: copyTile,
  cta: ctaTile,
  image: (cell) =>
    picture(
      cell,
      cell.brand.images[0] ?? cell.brand.image ?? undefined,
      cell.brand.accent,
      0.22
    ),
  image2: (cell) => picture(cell, cell.brand.images[1], cell.brand.ink, 1),
  logo: logoTile,
  tint: (cell) => cell.s.rect(cell.box, cell.brand.accent, cell.r, 0.35),
};

const bento =
  (lead: "copy" | "image") =>
  ({ brand, copy, frame, s, u }: Geo): void => {
    s.rect({ ...frame }, brand.paper);
    const grid = GRIDS[shapeOf(frame)][lead];
    const m = u * 0.04;
    const gap = u * 0.022;
    const cw = (frame.width - m * 2 - gap * (grid.cols - 1)) / grid.cols;
    const ch = (frame.height - m * 2 - gap * (grid.rows - 1)) / grid.rows;
    const r = u * 0.035;
    // The call to action goes down first: a design's button is the first
    // text sitting on a tile (roles.ts), and the copy sits on one too.
    const tiles = [...grid.tiles].sort(
      (a, b) => Number(b[4] === "cta") - Number(a[4] === "cta")
    );
    for (const [col, row, cs, rs, role] of tiles) {
      const box = {
        height: ch * rs + gap * (rs - 1),
        width: cw * cs + gap * (cs - 1),
        x: frame.x + m + col * (cw + gap),
        y: frame.y + m + row * (ch + gap),
      };
      TILES[role]({ box, brand, copy, r, s, u });
    }
  };

export const BENTO_BUILDERS: Record<
  (typeof BENTO_LAYOUTS)[number]["id"],
  (g: Geo) => void
> = {
  bento: bento("image"),
  "bento-copy": bento("copy"),
};
