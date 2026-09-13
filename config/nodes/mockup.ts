import type { NodeType } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";

/**
 * A cover shown as a book, for presenting.
 *
 * The last node in the cover pipeline and the one whose output leaves the
 * board: a client is sent the mockup, not the flat file. Three views — the
 * cover flat on a ground, the book standing at an angle with its spine
 * showing, and the print wrap laid open — from the same scene maths in
 * src/boards/canvas/mockupScene.ts, so the angled book cannot disagree with
 * the flat sheet about where the cover is.
 *
 * Wire the Cover's output into `cover`. Wire the Print wrap's output into
 * `wrap` as well and the angled view gets a real spine — type and all — and
 * the spread view shows the whole sheet. Without it the spine is a flat
 * colour and the spread shows the cover alone.
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
      default: "angled",
      key: "view",
      kind: "select",
      label: "View",
      optionLabels: { angled: "Standing", flat: "Flat", spread: "Wrap, open" },
      options: ["angled", "flat", "spread"],
    },
    {
      /*
       * The trim, needed only to read a wired wrap's proportions back into
       * a spine width. Same options as the Print wrap, and it should match.
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
    },
    {
      /*
       * Spine thickness in inches when no wrap is wired to read it from. A
       * 300-page trade paperback is about three quarters of an inch.
       */
      default: 0.75,
      key: "thickness",
      kind: "number",
      label: "Spine (in)",
      max: 2,
      min: 0.1,
      step: 0.05,
    },
    {
      default: "#ece7de",
      key: "background",
      kind: "color",
      label: "Ground",
    },
    {
      default: "#293341",
      key: "spine",
      kind: "color",
      label: "Spine colour",
      panel: true,
    },
  ],
};
