import {
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_TEXT_HEIGHT,
} from "../../../config/canvas.js";
import { DEFAULT_PLACEHOLDER } from "../../../config/nodes/iterate.js";
import { MAX_BATCH_COUNT } from "../../../config/nodes/limits.js";
import { OUTPUT_PORT_KEY } from "../../../config/ports.js";
import type { BoardItem, BoardWire } from "../../types";
import { newItemId } from "../io/newItemId";
import {
  DEFAULT_LOGO_MODEL,
  LOGO_MODELS,
  LOGO_STYLES,
  type LogoModelId,
  type LogoStyleId,
} from "./logoStyles";

/**
 * A board laid out for designing a logo.
 *
 * Boards already do everything a logo round needs — run a model, show the
 * variations, drag the good ones out, cut the background, trace to vector —
 * so this is not a new tool. It is a starting arrangement, wired:
 *
 *   Brief ───template──▶ Iterate ───prompt──▶ Generate
 *   Palette ──suffix───▶   (directions,          ▲
 *                           one per line)   Brand ┘ (prompt)
 *
 * The brief is the template, with `{}` where a direction goes. Iterate writes
 * one prompt per direction and Generate runs each of them `iterations` times,
 * so the whole round is one Run. Adding a direction is adding a line to the
 * Iterate node; changing the brief is one edit. After that it is an ordinary
 * board.
 */

/** What somebody fills in before the board is made. */
export interface LogoBrief {
  /** A brand kit to wire in, for its colours and voice. Optional. */
  brandKitId: string | null;
  /**
   * Hex colours picked for the mark, sent through a Palette node so a model
   * that takes a real palette gets one. Ignored when a kit is wired — the kit
   * already says its colours exactly.
   */
  colors: string[];
  /** What the business does, who it is for, anything that should show. */
  description: string;
  /** Variations per direction. */
  iterations: number;
  /** Which model the Generate node starts on. See LOGO_MODELS. */
  model: LogoModelId;
  /** The name the mark is for. */
  name: string;
  /** One line on the Iterate node each, in this order. */
  styles: LogoStyleId[];
}

/** Whether a model draws vectors itself, so there is nothing to trace. */
export const drawsVector = (model: string): boolean =>
  LOGO_MODELS.some((m) => m.id === model && m.vector);

/** A known logo model, or the default — never a free-typed id. */
const modelOf = (brief: LogoBrief): LogoModelId =>
  LOGO_MODELS.find((m) => m.id === brief.model)?.id ?? DEFAULT_LOGO_MODEL;

/** fal's name for a 1:1 picture. A logo is judged square first. */
const SQUARE = "square_hd";

const GAP = 80;
const SOURCE_WIDTH = 520;
const SOURCE_HEIGHT = DEFAULT_NODE_HEIGHT - 140;
const ITERATE_HEIGHT = DEFAULT_NODE_HEIGHT + 60;
/** Bigger than a stock node: it holds every variation of every direction. */
const GENERATE_WIDTH = DEFAULT_NODE_WIDTH + 160;
const GENERATE_HEIGHT = DEFAULT_NODE_HEIGHT + 200;
const HEADING_HEIGHT = DEFAULT_TEXT_HEIGHT;
const TOP = HEADING_HEIGHT + 40;

/**
 * Said once, in the brief, so every direction gets it.
 *
 * Plain white and centred because the next two steps are background removal
 * and tracing, and both do markedly better on a flat ground with margin.
 */
const PRODUCTION_LINE =
  "a single logo, centred, on a plain white background, no mockup, no extra text beyond the name, crisp edges, suitable for vector tracing";

/** The template Iterate fills in: the brief, with a slot for the direction. */
export const briefPrompt = (brief: LogoBrief): string =>
  [
    `Logo for "${brief.name.trim()}"`,
    brief.description.trim(),
    `style: ${DEFAULT_PLACEHOLDER}`,
    PRODUCTION_LINE,
    // The description is context, not copy: without this, type-capable models
    // letter it under the mark as a misspelled tagline.
    `the only words in the logo are "${brief.name.trim()}", no tagline, no slogan, no subtitle`,
  ]
    .filter(Boolean)
    .join(", ");

/** One direction per line — Iterate's own "split by lines" format. */
export const directionLines = (styles: readonly LogoStyleId[]): string =>
  styles
    .map(
      (id) => (LOGO_STYLES.find((s) => s.id === id) ?? LOGO_STYLES[0]).prompt
    )
    .join("\n");

const HEX = /^#[0-9a-f]{6}$/i;

/** The picked colours worth sending: valid, distinct, and only without a kit. */
export const paletteOf = (brief: LogoBrief): string[] =>
  brief.brandKitId
    ? []
    : [...new Set(brief.colors.map((c) => c.toLowerCase()))].filter((c) =>
        HEX.test(c)
      );

const clampIterations = (value: number): number =>
  Math.min(Math.max(Math.trunc(value) || 1, 1), MAX_BATCH_COUNT);

const BLANK = {
  body: null,
  config: null,
  creditName: null,
  creditUrl: null,
  fontSize: null,
  imageUrl: null,
  nodeType: null,
  photoId: null,
  result: null,
  runError: null,
  runState: null,
  thumbUrl: null,
} satisfies Partial<BoardItem>;

const wire = (
  source: BoardItem,
  target: BoardItem,
  targetPort: string
): BoardWire => ({
  id: newItemId(),
  sourceItemId: source.id,
  sourcePort: OUTPUT_PORT_KEY,
  targetItemId: target.id,
  targetPort,
});

/**
 * The steps after generating, on the board where they happen. A vector model
 * already hands back SVG, so the cleanup step is only offered when it applies.
 */
export const howTo = (model: string): string =>
  [
    "1. Press Run on Generate. Every direction runs at once.",
    "2. Add, remove or reword lines on Iterate to change the directions.",
    "3. Drag the ones you like into Picks.",
    drawsVector(model)
      ? "4. They're already SVG. Swap the model on Generate to compare others."
      : "4. Right-click a pick: Remove background, then Vectorize.",
    "5. Select picks and right-click → Send to a board to share them.",
  ].join("\n");

export const logoBoardTitle = (brief: LogoBrief): string =>
  `${brief.name.trim() || "Untitled"} — logo`;

interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** One op node, idle, with fresh identity. */
const opNode = (
  nodeType: string,
  config: Record<string, unknown>,
  box: Box,
  z: number
): BoardItem => ({
  ...BLANK,
  ...box,
  config,
  id: newItemId(),
  kind: "op",
  nodeType,
  runState: "idle",
  z,
});

/**
 * The items and wires, with fresh ids, laid out left to right:
 *
 *   [ name / brief / palette / brand / how-to ]  [ iterate ]  [ generate ]
 *                                                [ picks ─────────────── ]
 */
export const buildLogoBoard = (
  brief: LogoBrief
): { items: BoardItem[]; wires: BoardWire[] } => {
  const styles = brief.styles.length > 0 ? brief.styles : ["minimal" as const];
  let z = 0;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const heading: BoardItem = {
    ...BLANK,
    body: brief.name.trim() || "Untitled",
    fontSize: 64,
    height: HEADING_HEIGHT,
    id: newItemId(),
    kind: "text",
    width: SOURCE_WIDTH,
    x: 0,
    y: 0,
    z: nextZ(),
  };

  // The left column stacks downward; each source sits under the one before.
  let columnY = TOP;
  const stacked = (height: number): Box => {
    const box = { height, width: SOURCE_WIDTH, x: 0, y: columnY };
    columnY += height + GAP;
    return box;
  };

  const briefNode = opNode(
    "prompt",
    { text: briefPrompt(brief) },
    stacked(SOURCE_HEIGHT),
    nextZ()
  );

  const colors = paletteOf(brief);
  const paletteNode =
    colors.length > 0
      ? opNode(
          "palette",
          { colors: colors.join(", "), strictness: "only" },
          stacked(SOURCE_HEIGHT - 60),
          nextZ()
        )
      : null;

  const brandNode = brief.brandKitId
    ? opNode(
        "brand",
        { brandKitId: brief.brandKitId },
        stacked(SOURCE_HEIGHT),
        nextZ()
      )
    : null;

  const howToNote: BoardItem = {
    ...BLANK,
    ...stacked(DEFAULT_NOTE_HEIGHT + 100),
    body: howTo(modelOf(brief)),
    id: newItemId(),
    kind: "note",
    z: nextZ(),
  };

  const iterateX = SOURCE_WIDTH + GAP * 2;
  const iterateNode = opNode(
    "iterate",
    {
      placeholder: DEFAULT_PLACEHOLDER,
      split: "lines",
      values: directionLines(styles),
    },
    { height: ITERATE_HEIGHT, width: DEFAULT_NODE_WIDTH, x: iterateX, y: TOP },
    nextZ()
  );

  const generateX = iterateX + DEFAULT_NODE_WIDTH + GAP * 2;
  const generateNode = opNode(
    "generate",
    {
      count: clampIterations(brief.iterations),
      model: modelOf(brief),
      outputFormat: "png",
      size: SQUARE,
    },
    { height: GENERATE_HEIGHT, width: GENERATE_WIDTH, x: generateX, y: TOP },
    nextZ()
  );

  const picks: BoardItem = {
    ...BLANK,
    body: "Picks",
    height: DEFAULT_FRAME_HEIGHT,
    id: newItemId(),
    kind: "frame",
    width: generateX + GENERATE_WIDTH - iterateX,
    x: iterateX,
    y: TOP + GENERATE_HEIGHT + GAP * 2,
    // Under everything, so pictures dropped in sit on top of it.
    z: 0,
  };

  const wires: BoardWire[] = [
    wire(briefNode, iterateNode, "template"),
    ...(paletteNode ? [wire(paletteNode, iterateNode, "suffix")] : []),
    wire(iterateNode, generateNode, "prompt"),
    ...(brandNode ? [wire(brandNode, generateNode, "prompt")] : []),
  ];

  const items = [
    picks,
    heading,
    briefNode,
    ...(paletteNode ? [paletteNode] : []),
    ...(brandNode ? [brandNode] : []),
    howToNote,
    iterateNode,
    generateNode,
  ];
  return { items, wires };
};
