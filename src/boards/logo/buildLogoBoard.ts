import {
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_TEXT_HEIGHT,
} from "../../../config/canvas.js";
import { MAX_BATCH_COUNT } from "../../../config/nodes/limits.js";
import { OUTPUT_PORT_KEY } from "../../../config/ports.js";
import type { BoardItem, BoardWire } from "../../types";
import { newItemId } from "../io/newItemId";
import { LOGO_STYLES, type LogoStyleId } from "./logoStyles";

/**
 * A board laid out for designing a logo.
 *
 * Boards already do everything a logo round needs — run a model, show the
 * variations, drag the good ones out, cut the background, trace to vector —
 * so this is not a new tool. It is a starting arrangement: one brief that
 * every direction reads, one Generate node per direction, and an empty frame
 * to collect the picks. After that it is an ordinary board.
 *
 * The brief is a Prompt node wired into every Generate rather than text typed
 * on each, so changing the brand's description is one edit, not four. Each
 * Generate keeps its *direction* typed on itself: the run joins the typed text
 * with what is wired in (see jobsFor), so a node says "lettermark" and the
 * brief says what the lettermark is for.
 */

/** What somebody fills in before the board is made. */
export interface LogoBrief {
  /** A brand kit to wire in, for its colours and voice. Optional. */
  brandKitId: string | null;
  /** Colours in words — "deep green and cream". Ignored when a kit is wired. */
  colors: string;
  /** What the business does, who it is for, anything that should show. */
  description: string;
  /** Variations per direction. */
  iterations: number;
  /** The name the mark is for. */
  name: string;
  /** One Generate node each, in this order. */
  styles: LogoStyleId[];
}

/** Pinned rather than left on "auto", so a node says which model it uses. */
export const LOGO_MODEL = "fal-ai/nano-banana-pro";

/** fal's name for a 1:1 picture. A logo is judged square first. */
const SQUARE = "square_hd";

const GAP = 80;
const BRIEF_WIDTH = 560;
const HEADING_HEIGHT = DEFAULT_TEXT_HEIGHT;
const PICKS_HEIGHT = DEFAULT_FRAME_HEIGHT;
const HOW_TO_WIDTH = 520;
const LABEL_HEIGHT = 64;

/**
 * Said once, in the brief, so every direction gets it.
 *
 * Plain white and centred because the next two steps are background removal
 * and tracing, and both do markedly better on a flat ground with margin.
 */
const PRODUCTION_LINE =
  "a single logo, centred, on a plain white background, no mockup, no extra text beyond the name, crisp edges, suitable for vector tracing";

export const briefPrompt = (brief: LogoBrief): string =>
  [
    `Logo for "${brief.name.trim()}"`,
    brief.description.trim(),
    // A wired kit says the colours exactly; words here would compete with it.
    brief.brandKitId ? "" : brief.colors.trim(),
    PRODUCTION_LINE,
  ]
    .filter(Boolean)
    .join(", ");

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

/** The steps after generating, on the board where they happen. */
export const HOW_TO = [
  "1. Press Run on each direction.",
  "2. Drag the ones you like into Picks. Edit a direction's prompt and run again to push it further.",
  "3. Right-click a pick: Remove background, then Vectorize.",
  "4. Select picks and right-click → Send to board to share them.",
].join("\n");

export const logoBoardTitle = (brief: LogoBrief): string =>
  `${brief.name.trim() || "Untitled"} — logo`;

/**
 * The items and wires, with fresh ids, laid out left to right:
 *
 *   [ name / brief / brand ]  [ direction ] [ direction ] …
 *                             [ picks ──────────────────── ]
 */
export const buildLogoBoard = (
  brief: LogoBrief
): { items: BoardItem[]; wires: BoardWire[] } => {
  const styles = brief.styles.length > 0 ? brief.styles : ["minimal" as const];
  const iterations = clampIterations(brief.iterations);
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
    width: BRIEF_WIDTH,
    x: 0,
    y: 0,
    z: nextZ(),
  };

  const briefNode: BoardItem = {
    ...BLANK,
    config: { text: briefPrompt(brief) },
    height: DEFAULT_NODE_HEIGHT - 120,
    id: newItemId(),
    kind: "op",
    nodeType: "prompt",
    runState: "idle",
    width: BRIEF_WIDTH,
    x: 0,
    y: HEADING_HEIGHT + GAP / 2,
    z: nextZ(),
  };

  const brandNode: BoardItem | null = brief.brandKitId
    ? {
        ...BLANK,
        config: { brandKitId: brief.brandKitId },
        height: DEFAULT_NODE_HEIGHT - 120,
        id: newItemId(),
        kind: "op",
        nodeType: "brand",
        runState: "idle",
        width: BRIEF_WIDTH,
        x: 0,
        y: briefNode.y + briefNode.height + GAP,
        z: nextZ(),
      }
    : null;

  const left = BRIEF_WIDTH + GAP * 2;
  const columnX = (index: number) => left + index * (DEFAULT_NODE_WIDTH + GAP);
  const styleOf = (styleId: LogoStyleId) =>
    LOGO_STYLES.find((s) => s.id === styleId) ?? LOGO_STYLES[0];

  // A node's header names its type, not its purpose, so each direction gets a
  // caption above it — otherwise four identical "Generate" cards.
  const captions: BoardItem[] = styles.map((styleId, index) => ({
    ...BLANK,
    body: styleOf(styleId).label,
    fontSize: 28,
    height: LABEL_HEIGHT,
    id: newItemId(),
    kind: "text",
    width: DEFAULT_NODE_WIDTH,
    x: columnX(index),
    y: 0,
    z: nextZ(),
  }));

  const directions: BoardItem[] = styles.map((styleId, index) => {
    const style = styleOf(styleId);
    return {
      ...BLANK,
      config: {
        count: iterations,
        model: LOGO_MODEL,
        outputFormat: "png",
        prompt: style.prompt,
        size: SQUARE,
      },
      height: DEFAULT_NODE_HEIGHT,
      id: newItemId(),
      kind: "op",
      nodeType: "generate",
      runState: "idle",
      width: DEFAULT_NODE_WIDTH,
      x: columnX(index),
      y: LABEL_HEIGHT,
      z: nextZ(),
    };
  });

  const rowWidth =
    directions.length * DEFAULT_NODE_WIDTH + (directions.length - 1) * GAP;

  const picks: BoardItem = {
    ...BLANK,
    body: "Picks",
    height: PICKS_HEIGHT,
    id: newItemId(),
    kind: "frame",
    width: Math.max(rowWidth, DEFAULT_NODE_WIDTH * 2),
    x: left,
    y: LABEL_HEIGHT + DEFAULT_NODE_HEIGHT + GAP * 2,
    // Under everything, so pictures dropped in sit on top of it.
    z: 0,
  };

  const howTo: BoardItem = {
    ...BLANK,
    body: HOW_TO,
    height: DEFAULT_NOTE_HEIGHT + 80,
    id: newItemId(),
    kind: "note",
    width: HOW_TO_WIDTH,
    x: 0,
    y: (brandNode ?? briefNode).y + (brandNode ?? briefNode).height + GAP,
    z: nextZ(),
  };

  const wires: BoardWire[] = directions.flatMap((node) => [
    wire(briefNode, node, "prompt"),
    ...(brandNode ? [wire(brandNode, node, "prompt")] : []),
  ]);

  const items = [
    picks,
    heading,
    briefNode,
    ...(brandNode ? [brandNode] : []),
    howTo,
    ...captions,
    ...directions,
  ];
  return { items, wires };
};
