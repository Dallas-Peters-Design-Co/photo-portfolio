import type { NodeType } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";

/**
 * A picture finished as a book cover: brand palette, print texture, and type.
 *
 * The division is the one brandStamp.ts already makes. A model draws the field
 * and only the field; everything with a letterform in it is drawn afterwards,
 * pixel for pixel, from the settings on this node. Twenty AI-generated covers
 * in the Unruly Chain project are what happens without that rule — six
 * different title faces across twenty frames and an imprint mangled in nearly
 * all of them.
 *
 * It does not lay out artwork, because Composite already does: arrange the
 * pieces on a frame, wire the frame into a Composite, wire that in here. This
 * node's job starts where the picture is finished — clamp it to the palette,
 * screen it, grain it, and set the words.
 *
 * Rendered in the browser like Composite and Halftone: the finishing is a
 * WebGL pass and the type wants real font metrics. The run stores the URL the
 * browser produced — see board.cover in capabilities.ts.
 */
export const COVER: NodeType = {
  capability: "board.cover",
  id: "cover",
  inputs: [
    {
      /*
       * The finished artwork, cover-fitted into the trim.
       *
       * Many, because that is how variations are judged: a Generate node
       * making four takes on the field hands over four pictures, and the
       * question is which one works *as a cover* — with the title on the
       * band and the byline in place. So every picture wired in becomes a
       * cover, one variation each, the way a Halftone fans out.
       */
      arity: "many",
      key: "art",
      label: "Art",
      required: true,
      type: "image",
    },
    {
      /*
       * Title, subtitle and author, when they come from somewhere else.
       *
       * A Note wired in here beats retyping them on the node: the same words
       * can feed two covers, and a book's details become a thing on the board
       * that can be read rather than a value hidden in a settings panel.
       *
       * Either JSON — {"title":…,"subtitle":…,"author":…} — or up to three
       * plain lines in that order. The settings below win over both, so a node
       * can override one line without detaching the wire.
       */
      arity: "one",
      key: "words",
      label: "Words",
      required: false,
      type: "text",
    },
  ],
  label: "Cover",
  outputs: [{ key: OUTPUT_PORT_KEY, label: "Image", type: "image" }],
  settings: [
    {
      /*
       * Which design language. Poster puts the title on a solid band, which is
       * what makes it hold at thumbnail size — the type sits on a known ground
       * rather than on whatever the model drew. Horizon sets it over the art.
       */
      default: "poster",
      key: "variant",
      kind: "select",
      label: "Variant",
      optionLabels: { horizon: "Horizon", poster: "Poster" },
      options: ["poster", "horizon"],
    },
    {
      key: "title",
      kind: "text",
      label: "Title",
      maxLength: 48,
      placeholder: "CENTRIFUGE",
    },
    {
      key: "subtitle",
      kind: "text",
      label: "Subtitle",
      maxLength: 120,
      placeholder: "Inside the Emerging AI Organization",
    },
    {
      key: "author",
      kind: "text",
      label: "Author",
      maxLength: 48,
      placeholder: "Mitch Kelly",
    },

    /*
     * The finishing stack, as one shader pass rather than four filters.
     *
     * Every default is a no-op or close to it, so a Cover node dropped on a
     * board and run shows the artwork with type on it and nothing else done to
     * it. Someone turning `clamp` up is making a decision; nobody has to
     * discover they need to turn four things off.
     */
    {
      default: 0,
      key: "clamp",
      kind: "number",
      label: "Palette clamp",
      max: 1,
      min: 0,
      step: 0.05,
    },
    {
      /*
       * Up to six hexes, comma separated. What `clamp` pulls toward.
       *
       * Text rather than six colour wells: a palette is pasted from somewhere
       * else far more often than it is picked one swatch at a time, and this
       * is the same shape the Palette node already writes.
       */
      key: "palette",
      kind: "text",
      label: "Palette",
      maxLength: 200,
      panel: true,
      placeholder: "#c63b2e, #efe6d2, #3d564a, #354151",
    },
    {
      /*
       * Dot pitch in *output* pixels, for the reason halftoneGl.ts gives: a
       * screen ruling is a fixed pitch, so a bigger sheet carries more dots
       * rather than bigger ones. Zero turns the screen off.
       */
      default: 0,
      key: "dot",
      kind: "number",
      label: "Halftone dot",
      max: 12,
      min: 0,
      step: 0.5,
    },
    {
      default: 1,
      key: "gamma",
      kind: "number",
      label: "Halftone gamma",
      max: 2.5,
      min: 0.4,
      panel: true,
      step: 0.05,
    },
    {
      default: 0.18,
      key: "grain",
      kind: "number",
      label: "Grain",
      max: 1,
      min: 0,
      step: 0.01,
    },
    {
      default: 0.14,
      key: "vignette",
      kind: "number",
      label: "Vignette",
      max: 1,
      min: 0,
      step: 0.01,
    },
    {
      default: "#efe6d2",
      key: "ink",
      kind: "color",
      label: "Type",
      panel: true,
    },
    {
      default: "#293341",
      key: "band",
      kind: "color",
      label: "Band",
      panel: true,
    },
    {
      default: "#fa7c62",
      key: "accent",
      kind: "color",
      label: "Subtitle",
      panel: true,
    },
    {
      default: "#0a1112",
      key: "shadow",
      kind: "color",
      label: "Vignette tone",
      panel: true,
    },
  ],
};
