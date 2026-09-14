import { containedBy } from "../../../config/graph.js";
import { RENDER_URL_KEYS } from "../../../config/nodes/rendered.js";
import type { BoardItem } from "../../types";
import { outputImagesOf } from "../itemOutput";
import { renderCover } from "./renderCoverNode";
import { renderMockup } from "./renderMockupNode";
import { renderWrap } from "./renderWrapNode";
import {
  type Graph,
  wiredImageOnPort,
  wiredTextOnPort,
} from "./wiredPreviews";

/**
 * The nodes the browser finishes before a run: Cover, Print wrap, Mockup.
 *
 * All three are pictures only the browser can draw — a GPU pass, real font
 * metrics, a homography — and all three follow the shape Composite set: the
 * run stores a URL in the item's config, the server hands that URL back as
 * the result, and any edit upstream clears it (see placement.dropComposites)
 * so a stale render is never run.
 *
 * One table rather than three copies of the stage in useBoardRun.ts, which
 * had no room for even one more; and a single place to look when the next
 * node of this kind is added. Order matters: a Mockup reads a Wrap's URL,
 * and a Wrap reads a Cover's, so they finish in this order and each sees the
 * ones before it already written.
 */

export interface Finisher {
  /** Message when the render throws something that is not an Error. */
  failure: string;
  /** File name for the upload, which the blob store keeps as a hint. */
  file: string;
  /** Folder in the blob store. */
  folder: string;
  nodeType: string;
  render: (
    config: Record<string, unknown>,
    itemId: string,
    graph: Graph
  ) => Promise<Blob>;
  /** Where in config the run reads the URL from. Matches capabilities.ts. */
  urlKey: string;
}

export const FINISHERS: readonly Finisher[] = [
  {
    failure: "Could not render the cover",
    file: "cover.png",
    folder: "boards/covers",
    nodeType: "cover",
    render: (config, itemId, graph) =>
      renderCover(
        config,
        requirePicture(itemId, "art", "Art", graph),
        wiredTextOnPort(itemId, "words", graph)
      ),
    urlKey: "coverUrl",
  },
  {
    failure: "Could not render the print wrap",
    file: "wrap.png",
    folder: "boards/wraps",
    nodeType: "wrap",
    render: async (config, itemId, graph) =>
      (
        await renderWrap(config, {
          back: wiredImageOnPort(itemId, "back", graph),
          front: requirePicture(itemId, "front", "Front", graph),
          words: wiredTextOnPort(itemId, "words", graph),
        })
      ).blob,
    urlKey: "wrapUrl",
  },
  {
    failure: "Could not render the mockup",
    file: "mockup.png",
    folder: "boards/mockups",
    nodeType: "mockup",
    render: (config, itemId, graph) =>
      renderMockup(config, {
        cover: requirePicture(itemId, "cover", "Cover", graph),
      }),
    urlKey: "mockupUrl",
  },
];

/**
 * Why a required picture port has nothing on it, in words that say what to
 * fix.
 *
 * "Wire a picture in" is the wrong advice when a wire is already there and
 * what is on the other end is empty — a Batch nobody has fed, a frame with
 * nothing inside it, a node that has not run. That was the message for every
 * one of those, and it sent people checking a wire that was fine.
 */
const explainEmpty = (
  itemId: string,
  port: string,
  label: string,
  graph: Graph
): string => {
  const wire = graph.wires.find(
    (w) => w.targetItemId === itemId && w.targetPort === port
  );
  if (!wire) {
    return `Wire a picture into ${label}.`;
  }
  const source = graph.items.find((i) => i.id === wire.sourceItemId);
  if (!source) {
    return `${label} is wired from an item that is no longer on the board (${wire.sourceItemId.slice(0, 8)}).`;
  }
  if (source.kind === "frame") {
    const inside = containedBy(source, graph.items);
    const pictured = inside.filter((i) => i.imageUrl).length;
    return `${label} is wired from a frame holding ${inside.length} item${inside.length === 1 ? "" : "s"}, ${pictured} with a picture — a picture counts as inside when its centre is over the frame.`;
  }
  if (source.nodeType === "batch") {
    const feeding = graph.wires.filter(
      (w) => w.targetItemId === source.id && w.targetPort === "image"
    );
    const resolved = outputImagesOf(source, graph).length;
    return `${label} is wired from a Batch with ${feeding.length} wire${feeding.length === 1 ? "" : "s"} into it that resolve to ${resolved} picture${resolved === 1 ? "" : "s"}.`;
  }
  const name = source.nodeType ? `the ${source.nodeType} node` : `the ${source.kind}`;
  return `${label} is wired from ${name} (${source.id.slice(0, 8)}), which has no picture yet — run it first.`;
};

const requirePicture = (
  itemId: string,
  port: string,
  label: string,
  graph: Graph
): string => {
  const url = wiredImageOnPort(itemId, port, graph);
  if (!url) {
    throw new Error(explainEmpty(itemId, port, label, graph));
  }
  return url;
};

/**
 * nodeType → the config key its render lives under, for the three finishers.
 * Read off the shared table rather than restated, so the server, the canvas
 * and this stage cannot disagree about a key.
 */
export const FINISHER_URL_KEYS: Readonly<Record<string, string>> =
  Object.fromEntries(
    FINISHERS.map((f) => [f.nodeType, RENDER_URL_KEYS[f.nodeType] ?? f.urlKey])
  );

/**
 * Renders every finisher node that has no current render, in pipeline order.
 *
 * Sequential across kinds, parallel within one: two Covers can render at
 * once, but every Cover must be written before any Wrap starts, because the
 * Wrap will look for the Cover's URL through the graph. `graph` is read
 * fresh each stage so a URL written by the previous one is visible.
 *
 * A failure is reported and the item left as it was, so one broken node
 * does not stop the rest of the board running.
 */
export const finishItems = async (
  items: BoardItem[],
  graphOf: (items: BoardItem[]) => Graph,
  upload: (blob: Blob, file: string, folder: string) => Promise<string>,
  report: (message: string) => void
): Promise<BoardItem[]> => {
  let current = items;
  for (const finisher of FINISHERS) {
    const graph = graphOf(current);
    // biome-ignore lint/performance/noAwaitInLoops: stages depend on each other — a Wrap reads the Cover's URL the stage before wrote
    current = await Promise.all(
      current.map(async (item) => {
        if (item.nodeType !== finisher.nodeType) {
          return item;
        }
        const config = item.config ?? {};
        if (typeof config[finisher.urlKey] === "string") {
          return item;
        }
        try {
          const blob = await finisher.render(config, item.id, graph);
          const url = await upload(blob, finisher.file, finisher.folder);
          return { ...item, config: { ...config, [finisher.urlKey]: url } };
        } catch (err) {
          report(err instanceof Error ? err.message : finisher.failure);
          return item;
        }
      })
    );
  }
  return current;
};
