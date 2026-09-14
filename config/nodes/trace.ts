import type { NodeType } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";

/**
 * A picture traced into a layered SVG, in the browser, with the colours
 * you ask for.
 *
 * The Vectorize tool sends a picture to Recraft's vectoriser, which is built
 * for flat illustration: it quantises to a handful of fills and offers no
 * say in how many. A cover with halftone grain and a spiral of twenty
 * stripes comes back as six shapes. This node traces here instead — a
 * colour count up to 256, a detail dial, a blur for taming grain — and
 * hands over a real SVG that opens in Affinity with one layer per colour.
 *
 * It is a tracer, not a vectoriser that understands pictures: it fits
 * curves to regions of similar colour. Flat art with hard edges traces
 * cleanly; a photograph traces into a posterised painting, which is a
 * look, not a fault. Grain is the thing to decide about — blur it out for
 * clean shapes, or keep it and accept a large file.
 *
 * Rendered in the browser like Cover: the run stores the URL it produced —
 * see board.trace in capabilities.ts.
 */
export const TRACE: NodeType = {
  capability: "board.trace",
  id: "trace",
  inputs: [
    {
      /*
       * Many, as the Cover takes many: a batch of variations traced is a
       * batch of SVGs, one each, in wire order.
       */
      arity: "many",
      key: "image",
      label: "Image",
      required: true,
      type: "image",
    },
  ],
  label: "Trace",
  outputs: [{ key: OUTPUT_PORT_KEY, label: "SVG", type: "image" }],
  settings: [
    {
      /*
       * The palette the picture is reduced to before tracing. Sixteen is
       * the tracer's own default and is a poster; sixty-four holds a
       * gradient as bands you can see; two hundred and fifty-six is as
       * faithful as it goes and makes a file Affinity will feel.
       */
      default: 32,
      key: "colors",
      kind: "number",
      label: "Colours",
      max: 256,
      min: 2,
      step: 1,
    },
    {
      /*
       * How closely the curves follow the pixels. Smooth is a poster;
       * sharp keeps every notch of a halftone dot and pays for it in nodes.
       */
      default: "balanced",
      key: "detail",
      kind: "select",
      label: "Detail",
      optionLabels: { balanced: "Balanced", sharp: "Sharp", smooth: "Smooth" },
      options: ["smooth", "balanced", "sharp"],
    },
    {
      /*
       * Blur before tracing, in pixels. The one control that matters on a
       * grained picture: at 0 every grain becomes a shape, at 2 the grain
       * goes and the shapes stay.
       */
      default: 0,
      key: "blur",
      kind: "number",
      label: "Blur",
      max: 5,
      min: 0,
      step: 1,
    },
    {
      /*
       * Shapes smaller than this many path points are dropped. Speckle
       * control; raise it when a trace is all confetti.
       */
      default: 8,
      key: "speckle",
      kind: "number",
      label: "Drop specks under",
      max: 64,
      min: 0,
      panel: true,
      step: 1,
    },
    {
      /*
       * The longest side the picture is traced at. Tracing time grows with
       * the pixel count, and past about 1600 the extra nodes are grain, not
       * drawing. Coordinates are scaled back to the picture's own size, so
       * the SVG is the right dimensions whatever this is.
       */
      default: 1400,
      key: "size",
      kind: "number",
      label: "Trace at (px)",
      max: 2700,
      min: 400,
      panel: true,
      step: 100,
    },
    {
      /*
       * Stacked draws each colour's shapes over the ones before, which
       * gives clean edges and a file that is easy to recolour; cut-out
       * makes every shape its own island, which some tools prefer.
       */
      default: "stacked",
      key: "layering",
      kind: "select",
      label: "Layers",
      optionLabels: { cutout: "Cut out", stacked: "Stacked" },
      options: ["stacked", "cutout"],
      panel: true,
    },
  ],
};
