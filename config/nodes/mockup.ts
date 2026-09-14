import type { NodeType } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";

/**
 * A cover shown as a book, for presenting.
 *
 * The last node in the cover pipeline and the one whose output leaves the
 * board: a client is sent the mockup, not the flat file.
 *
 * Drawn into a photograph, not a model of one. The templates are the bought
 * Photoshop mockups in src/templates, baked once by scripts/bake-mockup.py
 * into pictures the browser can apply directly — the photograph, the shading
 * the mockup's author painted over the cover, and a map of where each point
 * of the cover lands. So the result is the Photoshop render, with the page
 * curl and the sheen, and not a shaded box. Which template is the only real
 * choice on the node.
 *
 * Rendered in the browser like Cover: the run stores the URL it produced —
 * see board.mockup in capabilities.ts.
 */
export const MOCKUP: NodeType = {
  capability: "board.mockup",
  id: "mockup",
  inputs: [
    {
      arity: "one",
      key: "cover",
      label: "Cover",
      required: true,
      type: "image",
    },
    {
      /*
       * The print wrap, for the templates that show the back of the book.
       * Its back panel is cut out by the trim below; without it the back is
       * the spine colour, which is what a blank proof looks like.
       */
      arity: "one",
      key: "wrap",
      label: "Print wrap",
      required: false,
      type: "image",
    },
  ],
  label: "Mockup",
  outputs: [{ key: OUTPUT_PORT_KEY, label: "Image", type: "image" }],
  settings: [
    {
      /*
       * One per baked template. The list is src/boards/canvas/mockupTemplate.ts;
       * the ids here must match its entries, and adding a template is baking
       * it and listing it in both.
       */
      default: "book-front",
      key: "template",
      kind: "select",
      label: "Template",
      optionLabels: {
        "book-front": "Face up",
        "book-open": "Open and closed",
        "book-soft-02": "Softcover, from above",
        "book-soft-04": "Softcover, standing",
        "book-soft-05": "Softcover, in a row",
        "book-stack": "Stacked",
        "book-tilt": "Tilted",
      },
      options: [
        "book-front",
        "book-tilt",
        "book-stack",
        "book-open",
        "book-soft-02",
        "book-soft-04",
        "book-soft-05",
      ],
    },
    {
      /*
       * The trim the wrap was made at, so its back panel can be found. Same
       * options as the Print wrap node, and it should match it.
       */
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
      panel: true,
    },
    {
      /*
       * The colour of a spine, where the template shows one. A spine strip
       * on these mockups is a few dozen pixels wide, too narrow for type to
       * read, so it takes the band colour rather than a slice of the wrap.
       */
      default: "#293341",
      key: "spine",
      kind: "color",
      label: "Spine & back",
      panel: true,
    },
  ],
};
