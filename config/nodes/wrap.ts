import type { NodeType } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";

/**
 * A front cover wrapped into a print cover: back, spine, front, with bleed.
 *
 * The last step before KDP, and the one that used to be a Photoshop script
 * and a Python spine calculator that had to agree with each other. The maths
 * is in src/boards/canvas/wrapLayout.ts, tested; this node is the settings
 * that feed it and the wiring that gets a picture in.
 *
 * Wire the Cover node's output into `front`. The back can take a second
 * picture — a render, or the same artwork — or be left empty for a flat panel
 * in the band colour with the copy set on it. Spine text is set from the
 * settings here and drawn only when KDP allows it (79 pages and up).
 *
 * Rendered in the browser like Cover: the run stores the URL it produced —
 * see board.wrap in capabilities.ts — and alongside it a print-ready PDF,
 * which is the file KDP actually takes.
 */
export const WRAP: NodeType = {
  capability: "board.wrap",
  id: "wrap",
  inputs: [
    {
      arity: "one",
      key: "front",
      label: "Front",
      required: true,
      type: "image",
    },
    {
      /*
       * Optional, and usually empty. A back cover is mostly copy, and copy on
       * a busy picture is copy nobody reads. Leaving this unwired gives a flat
       * panel in the band colour, which is what most trade paperbacks do.
       */
      arity: "one",
      key: "back",
      label: "Back art",
      required: false,
      type: "image",
    },
    {
      /*
       * The back-cover copy, when it lives somewhere on the board rather than
       * in a settings field. A Note is a better home for three paragraphs than
       * a text input is; the `copy` setting below wins if both are set.
       */
      arity: "one",
      key: "words",
      label: "Copy",
      required: false,
      type: "text",
    },
  ],
  label: "Print wrap",
  outputs: [{ key: OUTPUT_PORT_KEY, label: "Image", type: "image" }],
  settings: [
    {
      /*
       * Text, not a number: it comes from the manuscript and gets pasted, and
       * "312" is easier to trust when it is visibly the number typed than when
       * it is a stepper that might have been nudged.
       */
      key: "pages",
      kind: "text",
      label: "Page count",
      maxLength: 5,
      placeholder: "312",
    },
    {
      default: "cream",
      key: "paper",
      kind: "select",
      label: "Paper",
      optionLabels: {
        "color-premium": "Colour, premium",
        "color-standard": "Colour, standard",
        cream: "Cream",
        white: "White",
      },
      options: ["cream", "white", "color-standard", "color-premium"],
    },
    {
      default: "6x9",
      key: "trim",
      kind: "select",
      label: "Trim",
      optionLabels: {
        "5.25x8": "5.25 × 8",
        "5.5x8.5": "5.5 × 8.5",
        "5x8": "5 × 8",
        "6x9": "6 × 9",
      },
      options: ["6x9", "5.5x8.5", "5.25x8", "5x8"],
    },
    {
      key: "title",
      kind: "text",
      label: "Spine title",
      maxLength: 48,
      placeholder: "CENTRIFUGE",
    },
    {
      key: "author",
      kind: "text",
      label: "Spine author",
      maxLength: 48,
      placeholder: "Mitch Kelly",
    },
    {
      /*
       * Paragraphs, blank-line separated. The first line set larger as a
       * hook if it ends without a full stop — the way a back cover leads with
       * one sentence and then explains itself.
       */
      key: "copy",
      kind: "text",
      label: "Back copy",
      maxLength: 1200,
      panel: true,
      placeholder: "One sentence that sells it.\n\nThen two short paragraphs.",
    },
    {
      /*
       * KDP prints its barcode in the lower right of the back whatever is
       * there. "Clear" paints a white box so the proof shows the hole; "leave"
       * paints nothing, for a cover that will carry its own ISBN block.
       */
      default: "clear",
      key: "barcode",
      kind: "select",
      label: "Barcode zone",
      optionLabels: { clear: "White box", leave: "Leave as is" },
      options: ["clear", "leave"],
    },
    {
      /*
       * Trim, safe and spine lines over the render, for proofing on the board.
       * Never for the upload — turn it off before the PDF is taken, or take
       * it from a node with it off.
       */
      default: "off",
      key: "guides",
      kind: "select",
      label: "Guides",
      optionLabels: { off: "Off", on: "Show" },
      options: ["off", "on"],
    },
    {
      default: "#293341",
      key: "band",
      kind: "color",
      label: "Back & spine",
      panel: true,
    },
    {
      default: "#efe6d2",
      key: "ink",
      kind: "color",
      label: "Type",
      panel: true,
    },
  ],
};
