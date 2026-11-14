import { r2 } from "../rng";

/**
 * A tile's fill as SVG attributes, or null for a tile that's fully clear.
 *
 * A colour with transparency (#rrggbbaa, from the pickers) is written as a
 * plain fill and a fill-opacity, which every SVG reader understands (Canva and
 * Illustrator included), rather than the eight-digit hex browsers accept. A
 * clear tile is left out of the file altogether.
 */
export const paintOf = (colour: string): string | null => {
  if (colour.length === 9) {
    const alpha = Number.parseInt(colour.slice(7, 9), 16) / 255;
    if (alpha <= 0.002) {
      return null;
    }
    const base = `fill="${colour.slice(0, 7)}"`;
    return alpha >= 0.998 ? base : `${base} fill-opacity="${r2(alpha)}"`;
  }
  return `fill="${colour}"`;
};

export const shape = (
  kind: string,
  x: number,
  y: number,
  s: number,
  /** The fill attributes (paintOf). */
  fill: string,
  flip: boolean
) => {
  const c = s / 2;
  switch (kind) {
    case "circle":
      return `<circle cx="${r2(x + c)}" cy="${r2(y + c)}" r="${r2(c)}" ${fill}/>`;
    case "diamond":
      return `<path d="M${r2(x + c)} ${r2(y)}L${r2(x + s)} ${r2(y + c)}L${r2(x + c)} ${r2(y + s)}L${r2(x)} ${r2(y + c)}Z" ${fill}/>`;
    case "triangle":
      return flip
        ? `<path d="M${r2(x)} ${r2(y + s)}L${r2(x + c)} ${r2(y)}L${r2(x + s)} ${r2(y + s)}Z" ${fill}/>`
        : `<path d="M${r2(x)} ${r2(y)}L${r2(x + s)} ${r2(y)}L${r2(x + c)} ${r2(y + s)}Z" ${fill}/>`;
    case "hex": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        return `${r2(x + c + Math.cos(a) * c)} ${r2(y + c + Math.sin(a) * c)}`;
      });
      return `<path d="M${pts.join("L")}Z" ${fill}/>`;
    }
    default:
      return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(s)}" height="${r2(s)}" ${fill}/>`;
  }
};
