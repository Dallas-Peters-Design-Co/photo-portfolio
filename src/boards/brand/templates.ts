import billboard from "../../templates/billboard.png";
import bookFlat from "../../templates/book-flat.jpg";
import bookSoft from "../../templates/book-soft02.jpg";
import bookRow from "../../templates/book-soft05.jpg";
import bookStanding from "../../templates/book-standing.jpg";
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
 * Each entry is one photograph, the part of it worth looking at, the rectangle
 * the mark belongs in, and how the mark should meet the surface. Adding one is
 * a file and a handful of numbers.
 *
 * Every fraction is of the whole photograph, never of what ends up on screen.
 * They were of the visible frame once, which meant changing how a photograph
 * was framed silently moved the mark on it — the numbers described the result
 * rather than the object, and the lanyard's badge drifted off its own card.
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

interface Rect {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface Template {
  /** Where the mark goes, as fractions of the whole photograph. */
  area: Rect;
  blend: Blend;
  caption: string;
  /**
   * The part of the photograph worth showing, as fractions of it.
   *
   * A stock mockup is shot with room around the subject for a designer to
   * crop into, and using it uncropped wastes most of a square tile on a grey
   * wall — the lanyard came out as a thumbnail of a badge adrift in white. The
   * crop is cover-fitted, so it is a region of interest rather than an exact
   * frame. Absent means the whole photograph.
   */
  crop?: Rect;
  id: string;
  image: string;
  /** Recolour the mark to this before placing it, when the surface demands. */
  ink?: string;
  label: string;
  /** How much of the mark's colour survives the blend. */
  opacity?: number;
  /**
   * Paint the area this colour before the mark goes on it.
   *
   * For a mockup shipped with its own demo artwork already printed on the
   * surface. Without a plate the sample cover shows around whatever the mark
   * does not cover, and the tile is two designs fighting. The photograph's own
   * shading is multiplied back over the top afterwards, so the plate is a
   * blank page on the object rather than a sticker over it.
   */
  plate?: string;
}

export const TEMPLATES: readonly Template[] = [
  {
    /*
     * Inset from the panel, not flush to it.
     *
     * The first pass filled the lit panel edge to edge, which is not how
     * anything is ever printed — a poster has a margin, and without one the
     * mark reads as the billboard rather than as artwork on it.
     */
    area: { h: 0.53, w: 0.39, x: 0.32, y: 0.11 },
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
    /*
     * Square, and measured: the lit panel is x 0.287–0.742, y 0.067–0.685 of
     * the photograph and its frame runs to y 0.75. The crop is cover-fitted
     * into a square tile, so a crop that is not itself square loses its top
     * and bottom — the old one took the top of the frame off and left the
     * mark sitting high. This one is 947 px each way, centred on the panel,
     * with the frame whole and a little of the stand.
     */
    crop: { h: 0.78, w: 0.784, x: 0.117, y: 0.01 },
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
    area: { h: 0.13, w: 0.24, x: 0.38, y: 0.4 },
    blend: "screen",
    caption:
      "Embroidered on a cap, in one light ink on dark cloth. The seam runs through it and the weave shows.",
    crop: { h: 0.7, w: 0.84, x: 0.08, y: 0.12 },
    id: "hat",
    image: hat,
    ink: "#f2f2f0",
    label: "Cap",
    opacity: 0.92,
  },
  {
    /*
     * Dark ink on a pale card, which is the only way a badge is ever printed.
     *
     * It was light ink screened onto light plastic, which is a recipe for
     * nothing: the mark was there, and invisible, and the tile said the
     * artwork worked on a lanyard when it had never been shown. Multiply is
     * what ink on a white card does, and it lets the card's own sheen fall
     * across the print.
     */
    area: { h: 0.22, w: 0.32, x: 0.325, y: 0.42 },
    blend: "multiply",
    caption:
      "On a lanyard badge, at the size it is read from arm's length across a table.",
    crop: { h: 0.68, w: 0.58, x: 0.2, y: 0.28 },
    id: "lanyard",
    image: lanyard,
    label: "Lanyard",
  },
  {
    /*
     * A paperback lying face up. The whole front, spine excluded.
     *
     * The imprint's own use, and the one surface on this sheet where the mark
     * is not a mark but the entire field — a cover is judged as a rectangle of
     * artwork at arm's length, which nothing else here asks.
     */
    area: { h: 0.628, w: 0.236, x: 0.386, y: 0.205 },
    blend: "multiply",
    caption:
      "A paperback face up, lit from the left. The cover as a whole rectangle, at the distance it is picked up from.",
    crop: { h: 0.9, w: 0.52, x: 0.24, y: 0.08 },
    id: "book-flat",
    image: bookFlat,
    label: "Book cover",
    plate: "#ffffff",
  },
  {
    area: { h: 0.585, w: 0.185, x: 0.386, y: 0.205 },
    blend: "multiply",
    caption:
      "The same cover standing on a shelf, seen slightly from the side. Where a spine-heavy design loses its front.",
    crop: { h: 0.9, w: 0.52, x: 0.24, y: 0.06 },
    id: "book-standing",
    image: bookStanding,
    label: "Book, standing",
    plate: "#ffffff",
  },
  {
    /*
     * A softcover flat lay, shot from above.
     *
     * The one that looks like a photograph of a finished book rather than a
     * mockup of one, which is what a client is being asked to imagine. Only
     * the front is plated: the back of the pair keeps the sample artwork on
     * purpose, so the tile shows a cover in a pile of covers instead of a
     * cover alone.
     */
    area: { h: 0.576, w: 0.271, x: 0.2, y: 0.21 },
    blend: "multiply",
    caption:
      "A softcover flat on a table, front up, shot from above. The nearest thing on this sheet to a photograph of the finished book.",
    crop: { h: 0.84, w: 0.52, x: 0.1, y: 0.08 },
    id: "book-soft",
    image: bookSoft,
    label: "Softcover, flat",
    plate: "#ffffff",
  },
  {
    /*
     * Three on a shelf, the middle one plated.
     *
     * A cover is never met alone. The two beside it keep the mockup's own
     * sample artwork, which is the point — the test is whether the design
     * holds its own place in a row, and a row of three identical covers would
     * not ask that.
     */
    area: { h: 0.435, w: 0.2, x: 0.402, y: 0.298 },
    blend: "multiply",
    caption:
      "One of three on a shelf. Whether the cover holds its own place in a row, beside covers that are not yours.",
    crop: { h: 0.6, w: 0.4, x: 0.3, y: 0.2 },
    id: "book-row",
    image: bookRow,
    label: "Book, in a row",
    plate: "#ffffff",
  },
];
