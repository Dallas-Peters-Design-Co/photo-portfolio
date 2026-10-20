import type { BoardItem, BoardWire } from "../../types";
import { currentImageUrl, outputImagesOf, outputListOf } from "../itemOutput";

/**
 * Everything wired into a Video node, read off the board.
 *
 * One place for it because three things need the same answer: the run, which
 * sends it; the node, which says what it is about to send; and the refusal,
 * which says what is missing. Two of them disagreeing about whether a start
 * frame is wired is the bug this tool keeps having.
 */

export interface VideoInputs {
  /** The last frame, for an endpoint that interpolates towards one. */
  end: string | null;
  /** The first frame, which text-to-video endpoints do without. */
  image: string | null;
  /** Words from the Prompt port, one per wired line, in wire order. */
  prompts: string[];
  /** Every picture sent as a reference, however many wires brought them. */
  references: string[];
  /** A clip to rework or extend. */
  video: string | null;
}

interface Graph {
  items: BoardItem[];
  wires: BoardWire[];
}

const sourcesOf = (item: BoardItem, port: string, graph: Graph) =>
  graph.wires
    .filter((w) => w.targetItemId === item.id && w.targetPort === port)
    .map((w) => graph.items.find((i) => i.id === w.sourceItemId) ?? null);

/** The last picture wired to a port that holds one; a later wire replaces. */
const singleImage = (
  item: BoardItem,
  port: string,
  graph: Graph
): string | null =>
  sourcesOf(item, port, graph)
    .flatMap((source) => outputImagesOf(source, graph))
    .at(-1) ?? null;

/** A clip is whatever a video node last made; nothing else carries one. */
const singleClip = (item: BoardItem, graph: Graph): string | null => {
  const source = sourcesOf(item, "video", graph).at(-1);
  return source?.nodeType === "video" ? currentImageUrl(source) : null;
};

export const videoInputsOf = (item: BoardItem, graph: Graph): VideoInputs => {
  const references = sourcesOf(item, "references", graph).flatMap((source) =>
    outputImagesOf(source, graph)
  );
  return {
    end: singleImage(item, "end", graph),
    image: singleImage(item, "image", graph),
    prompts: sourcesOf(item, "prompt", graph).flatMap((source) =>
      outputListOf(source, graph)
    ),
    // Deduplicated: the same photograph reached by two wires is one reference,
    // and sending it twice is billed as two on the endpoints that count them.
    references: [...new Set(references)],
    video: singleClip(item, graph),
  };
};
