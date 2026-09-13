import billboard from "../../templates/billboard.png";
import hat from "../../templates/hat.png";
import lanyard from "../../templates/lanyard.png";

/**
 * Photographs to put a mark on.
 *
 * The drawn rectangles they replace were a stand-in and looked like one. A
 * client is the audience for this sheet, and a client reads a flat grey
 * rectangle as a diagram and a photograph of a lit billboard as the thing
 * itself. The difference is not decoration — it is whether the sheet is
 * evidence or a wireframe.
 *
 * Each entry is one photograph, the rectangle on it the mark belongs in, and
 * how the mark should meet the surface. Adding one is a file and six numbers.
 */

/**
 * How the mark sits on the surface.
 *
 * The setting that separates a mockup from a sticker. `multiply` lets a lit
 * panel's own gradient darken the artwork, so a billboard's hotspot falls
 * across the mark as well as around it. `screen` does the same for light ink
 * on a dark surface, letting seams and weave show through the mark rather than
 * stopping at its edge. `source-over` is for a surface with nothing to say.
 */
export type Blend = Extract<
  GlobalCompositeOperation,
  "multiply" | "screen" | "source-over"
>;

export interface Template {
  /** Where the mark goes, as fractions of the photograph. */
  area: { h: number; w: number; x: number; y: number };
  blend: Blend;
  caption: string;
  id: string;
  image: string;
  /** Recolour the mark to this before placing it, when the surface demands. */
  ink?: string;
  label: string;
  /** How much of the mark's colour survives the blend. */
  opacity?: number;
}

export const TEMPLATES: readonly Template[] = [
  {
    area: { h: 0.63, w: 0.48, x: 0.281, y: 0.059 },
    /*
     * Multiply, so the panel's own light falls on the artwork.
     *
     * The photograph has a hotspot near the middle and darkens to the edges.
     * Drawn normally the mark ignores all of it and reads as a sticker on a
     * photo; multiplied, the same light crosses the mark and it sits inside
     * the frame.
     */
    blend: "multiply",
    caption:
      "On a lit billboard, at the size it is read from across a street. The first place a fine line disappears.",
    id: "billboard",
    image: billboard,
    label: "Billboard",
  },
  {
    /*
     * The crown front, above the seam and below the button.
     *
     * Small on purpose: an embroidered mark on a cap is small, and drawing it
     * large would flatter the artwork by testing something nobody prints.
     */
    area: { h: 0.17, w: 0.26, x: 0.37, y: 0.42 },
    blend: "screen",
    caption:
      "Embroidered on a cap, in one light ink on dark cloth. The seam runs through it and the weave shows.",
    id: "hat",
    image: hat,
    ink: "#f2f2f0",
    label: "Cap",
    opacity: 0.92,
  },
  {
    area: { h: 0.14, w: 0.2, x: 0.4, y: 0.36 },
    blend: "screen",
    caption: "On a lanyard, at the size a badge carries it.",
    id: "lanyard",
    image: lanyard,
    ink: "#f2f2f0",
    label: "Lanyard",
    opacity: 0.9,
  },
];
