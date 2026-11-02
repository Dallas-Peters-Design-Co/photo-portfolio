/**
 * One design, many ad sizes.
 *
 * A frame is the ad; what's inside it is the design. Changing the frame to
 * another size moves and scales everything inside so the design still reads:
 * a logo in the top-left corner stays in the top-left corner, a headline in
 * the middle stays centred, a photo filling the frame keeps filling it.
 *
 * How each item behaves is its *pin*, worked out from where it sits:
 *
 *   horizontal  left | center | right | stretch
 *   vertical    top  | center | bottom | stretch
 *
 * Content scales uniformly by the smaller of the two size changes, so type
 * and shapes keep their proportions and nothing spills out of the frame. A
 * stretched axis fills the new frame instead, keeping its margins in
 * proportion (a full-bleed photo; images use object-fit: cover, so stretching
 * the box crops rather than distorts).
 *
 * Pure geometry, shared by the canvas and the tests.
 */

export interface AdSize {
  group: string;
  h: number;
  id: string;
  label: string;
  w: number;
}

/** Common sizes, in pixels. */
export const AD_SIZES: AdSize[] = [
  {
    group: "Instagram",
    h: 1080,
    id: "ig-square",
    label: "Post · square",
    w: 1080,
  },
  {
    group: "Instagram",
    h: 1350,
    id: "ig-portrait",
    label: "Post · portrait",
    w: 1080,
  },
  {
    group: "Instagram",
    h: 1920,
    id: "ig-story",
    label: "Story / Reel",
    w: 1080,
  },
  { group: "Facebook", h: 630, id: "fb-link", label: "Link / feed", w: 1200 },
  { group: "Facebook", h: 312, id: "fb-cover", label: "Page cover", w: 820 },
  { group: "LinkedIn", h: 627, id: "li-post", label: "Post", w: 1200 },
  { group: "LinkedIn", h: 396, id: "li-banner", label: "Banner", w: 1584 },
  { group: "X", h: 675, id: "x-post", label: "Post", w: 1200 },
  { group: "X", h: 500, id: "x-header", label: "Header", w: 1500 },
  { group: "Pinterest", h: 1500, id: "pin", label: "Pin", w: 1000 },
  { group: "YouTube", h: 720, id: "yt-thumb", label: "Thumbnail", w: 1280 },
  {
    group: "Landing",
    h: 900,
    id: "landing-desktop",
    label: "Hero · desktop",
    w: 1440,
  },
  {
    group: "Landing",
    h: 844,
    id: "landing-mobile",
    label: "Hero · mobile",
    w: 390,
  },
  { group: "Deck", h: 1080, id: "deck-wide", label: "Slide · 16:9", w: 1920 },
  {
    group: "Deck",
    h: 1080,
    id: "deck-standard",
    label: "Slide · 4:3",
    w: 1440,
  },
  { group: "Email", h: 300, id: "email-banner", label: "Banner", w: 600 },
  { group: "Email", h: 1200, id: "email-full", label: "Full email", w: 600 },
  // Print, at 300 dpi: inches × 300. Portrait; the frame can be turned.
  {
    group: "Print",
    h: 3300,
    id: "flyer-letter",
    label: "Flyer · Letter",
    w: 2550,
  },
  { group: "Print", h: 5100, id: "print-11x17", label: "Poster · 11×17", w: 3300 },
  { group: "Print", h: 5400, id: "print-12x18", label: "Poster · 12×18", w: 3600 },
  { group: "Print", h: 7200, id: "print-18x24", label: "Poster · 18×24", w: 5400 },
  { group: "Print", h: 10_800, id: "print-24x36", label: "Poster · 24×36", w: 7200 },
  { group: "Print", h: 4961, id: "print-a3", label: "Poster · A3", w: 3508 },
  { group: "Print", h: 7016, id: "print-a2", label: "Poster · A2", w: 4961 },
  { group: "Print", h: 9933, id: "print-a1", label: "Poster · A1", w: 7016 },
];

/** Print sizes are set at this many pixels to the inch. */
export const PRINT_DPI = 300;

/** Canvas units per pixel for a frame that doesn't say its size yet. */
export const DEFAULT_UNITS_PER_PX = 0.5;

export type HPin = "left" | "center" | "right" | "stretch";
export type VPin = "top" | "center" | "bottom" | "stretch";
export interface Pin {
  h: HPin;
  v: VPin;
}

export interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface LayoutItem extends Box {
  fontSize: number | null;
  id: string;
  kind: string;
}

/** "Instagram · Post · square · 1080×1080": what a sized frame is called. */
export const sizeTitle = (size: AdSize): string =>
  `${size.group} · ${size.label} · ${size.w}×${size.h}`;

const SIZE_IN_TITLE = /(\d{2,5})\s*[×x]\s*(\d{2,5})\s*$/;

/** What a sized frame is for: the group at the front of its title. */
export const groupFromTitle = (title: string | null | undefined): string =>
  AD_SIZES.find((s) => (title ?? "").startsWith(`${s.group} · `))?.group ?? "";

/** The pixel size a frame was given, read back from its title. */
export const sizeFromTitle = (
  title: string | null | undefined
): { h: number; w: number } | null => {
  const match = SIZE_IN_TITLE.exec(title ?? "");
  if (!match) {
    return null;
  }
  const w = Number(match[1]);
  const h = Number(match[2]);
  return w > 0 && h > 0 ? { h, w } : null;
};

/**
 * How big a size should be on the canvas: at the same scale as the frame it
 * comes from when that frame has a size, otherwise at the default scale.
 */
export const frameBoxFor = (
  size: { h: number; w: number },
  from: Box & { body?: string | null }
): { height: number; width: number } => {
  const known = sizeFromTitle(from.body);
  const unitsPerPx = known ? from.width / known.w : DEFAULT_UNITS_PER_PX;
  return {
    height: Math.round(size.h * unitsPerPx),
    width: Math.round(size.w * unitsPerPx),
  };
};

const FILL = 0.9;
const EDGE_THIRD = 1 / 3;

/** Where an item is pinned, from where it sits in its frame. */
export const inferPin = (item: Box, frame: Box): Pin => {
  const axis = (
    start: number,
    size: number,
    frameStart: number,
    frameSize: number
  ): "start" | "center" | "end" | "stretch" => {
    if (size >= frameSize * FILL) {
      return "stretch";
    }
    const centre = (start + size / 2 - frameStart) / frameSize;
    if (centre < EDGE_THIRD) {
      return "start";
    }
    if (centre > 1 - EDGE_THIRD) {
      return "end";
    }
    return "center";
  };
  const h = axis(item.x, item.width, frame.x, frame.width);
  const v = axis(item.y, item.height, frame.y, frame.height);
  const H_NAME = {
    center: "center",
    end: "right",
    start: "left",
    stretch: "stretch",
  } as const;
  const V_NAME = {
    center: "center",
    end: "bottom",
    start: "top",
    stretch: "stretch",
  } as const;
  return { h: H_NAME[h], v: V_NAME[v] };
};

/** One axis: where the item starts and how long it is in the new frame. */
const place = (
  pin: "start" | "center" | "end" | "stretch",
  offset: number,
  size: number,
  oldFrame: number,
  newFrame: number,
  scale: number
): { offset: number; size: number } => {
  if (pin === "stretch") {
    const ratio = newFrame / oldFrame;
    const before = offset * ratio;
    const after = (oldFrame - offset - size) * ratio;
    return { offset: before, size: Math.max(1, newFrame - before - after) };
  }
  const scaled = size * scale;
  if (pin === "start") {
    return { offset: offset * scale, size: scaled };
  }
  if (pin === "end") {
    const margin = (oldFrame - offset - size) * scale;
    return { offset: newFrame - margin - scaled, size: scaled };
  }
  const fromCentre = (offset + size / 2 - oldFrame / 2) * scale;
  return { offset: newFrame / 2 + fromCentre - scaled / 2, size: scaled };
};

const H_AXIS = {
  center: "center",
  left: "start",
  right: "end",
  stretch: "stretch",
} as const;
const V_AXIS = {
  bottom: "end",
  center: "center",
  stretch: "stretch",
  top: "start",
} as const;

export interface RelayoutOptions {
  maxFont?: number;
  minFont?: number;
  minSize?: number;
}

/**
 * Lays a frame's contents out in a frame of a new size and position.
 * Returns each item's new box (and font size), in the same order.
 */
export const relayout = <T extends LayoutItem>(
  frame: Box,
  next: Box,
  items: readonly T[],
  pins: Record<string, Pin> = {},
  { maxFont = 400, minFont = 8, minSize = 1 }: RelayoutOptions = {}
): T[] => {
  const scale = Math.min(next.width / frame.width, next.height / frame.height);
  return items.map((item) => {
    const pin = pins[item.id] ?? inferPin(item, frame);
    const hx = place(
      H_AXIS[pin.h],
      item.x - frame.x,
      item.width,
      frame.width,
      next.width,
      scale
    );
    const vy = place(
      V_AXIS[pin.v],
      item.y - frame.y,
      item.height,
      frame.height,
      next.height,
      scale
    );
    const fontSize =
      item.fontSize === null
        ? null
        : Math.min(
            maxFont,
            Math.max(minFont, Math.round(item.fontSize * scale * 10) / 10)
          );
    return {
      ...item,
      fontSize,
      height: Math.max(minSize, Math.round(vy.size)),
      width: Math.max(minSize, Math.round(hx.size)),
      x: Math.round(next.x + hx.offset),
      y: Math.round(next.y + vy.offset),
    };
  });
};
