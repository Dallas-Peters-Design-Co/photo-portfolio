import { containedBy } from "../../../config/graph.js";
import { MAX_SHADER_RENDERS } from "../../../config/nodes/limits.js";
import { RENDER_URL_KEYS } from "../../../config/nodes/rendered.js";
import type { BoardItem } from "../../types";
import { outputImagesOf } from "../itemOutput";
import { renderCover } from "./renderCoverNode";
import { renderMockup } from "./renderMockupNode";
import { renderTrace } from "./renderTraceNode";
import { renderWrap } from "./renderWrapNode";
import {
  type Graph,
  wiredImageOnPort,
  wiredImagesOnPort,
  wiredTextOnPort,
} from "./wiredPreviews";

/**
 * The nodes the browser finishes before a run: Trace, Cover, Print wrap, Mockup.
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
  /**
   * One render, or — when `each` is set — one per picture on that port, in
   * wire order. The run asks for the nth under `${urlKey}s`, as the Halftone
   * does with renderUrls; `urlKey` alone still holds the first.
   */
  each?: string;
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
    graph: Graph,
    /** The picture this render is for, when `each` is set. */
    picture?: string
  ) => Promise<Blob>;
  /** Where in config the run reads the URL from. Matches capabilities.ts. */
  urlKey: string;
}

export const FINISHERS: readonly Finisher[] = [
  {
    each: "image",
    failure: "Could not trace the picture",
    file: "trace.svg",
    folder: "boards/traces",
    nodeType: "trace",
    render: (config, itemId, graph, picture) =>
      renderTrace(
        config,
        picture ?? requirePicture(itemId, "image", "Image", graph)
      ),
    urlKey: "traceUrl",
  },
  {
    each: "art",
    failure: "Could not render the cover",
    file: "cover.png",
    folder: "boards/covers",
    nodeType: "cover",
    render: (config, itemId, graph, picture) =>
      renderCover(
        config,
        picture ?? requirePicture(itemId, "art", "Art", graph),
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
    each: "cover",
    failure: "Could not render the mockup",
    file: "mockup.png",
    folder: "boards/mockups",
    nodeType: "mockup",
    render: (config, itemId, graph, picture) => {
      const all = wiredImagesOnPort(itemId, "cover", graph);
      const cover = picture ?? requirePicture(itemId, "cover", "Cover", graph);
      // The rest of the batch, starting after this one, for a template of
      // several books: mockup n leads with cover n and the others follow, so
      // five covers on a three-book template are five different rows.
      const at = Math.max(0, all.indexOf(cover));
      const others = [...all.slice(at + 1), ...all.slice(0, at)];
      return renderMockup(config, {
        cover,
        others,
        // One wrap for all of them: the back is the same book's back.
        wrap: wiredImageOnPort(itemId, "wrap", graph),
      });
    },
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
  const name = source.nodeType
    ? `the ${source.nodeType} node`
    : `the ${source.kind}`;
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
type Upload = (blob: Blob, file: string, folder: string) => Promise<string>;

/** The pictures a fanning-out finisher renders, in wire order, capped. */
const picturesFor = (item: BoardItem, port: string, graph: Graph): string[] =>
  wiredImagesOnPort(item.id, port, graph).slice(0, MAX_SHADER_RENDERS);

/**
 * Whether the node's stored render is still current.
 *
 * For a node that fans out, only a list with one render per picture wired
 * in counts: a lone URL with no list is a render from before the node
 * fanned out, and a list of the wrong length is from before a wire moved —
 * either would hand the run one mockup for five covers.
 */
const isCurrent = (
  item: BoardItem,
  finisher: Finisher,
  graph: Graph
): boolean => {
  const config = item.config ?? {};
  const list = config[`${finisher.urlKey}s`];
  const stored = Array.isArray(list) ? list : null;
  if (finisher.each) {
    const wanted = picturesFor(item, finisher.each, graph).length;
    return stored !== null && wanted > 0 && stored.length === wanted;
  }
  return (
    typeof config[finisher.urlKey] === "string" ||
    (stored !== null && stored.length > 0)
  );
};

/** One node rendered and uploaded: its config with the URL, or URLs, in. */
const finishOne = async (
  item: BoardItem,
  finisher: Finisher,
  graph: Graph,
  upload: Upload
): Promise<BoardItem> => {
  const config = item.config ?? {};
  if (!finisher.each) {
    const blob = await finisher.render(config, item.id, graph);
    const url = await upload(blob, finisher.file, finisher.folder);
    return { ...item, config: { ...config, [finisher.urlKey]: url } };
  }
  // One per picture, in wire order, so variation n is picture n.
  const pictures = picturesFor(item, finisher.each, graph);
  if (pictures.length === 0) {
    requirePicture(item.id, finisher.each, finisher.each, graph);
  }
  const urls = await Promise.all(
    pictures.map(async (picture) => {
      const blob = await finisher.render(config, item.id, graph, picture);
      return await upload(blob, finisher.file, finisher.folder);
    })
  );
  return {
    ...item,
    config: {
      ...config,
      [finisher.urlKey]: urls[0],
      [`${finisher.urlKey}s`]: urls,
    },
  };
};

export const finishItems = async (
  items: BoardItem[],
  graphOf: (items: BoardItem[]) => Graph,
  upload: Upload,
  report: (message: string) => void
): Promise<BoardItem[]> => {
  let current = items;
  for (const finisher of FINISHERS) {
    const graph = graphOf(current);
    // biome-ignore lint/performance/noAwaitInLoops: stages depend on each other — a Wrap reads the Cover's URL the stage before wrote
    current = await Promise.all(
      current.map(async (item) => {
        if (
          item.nodeType !== finisher.nodeType ||
          isCurrent(item, finisher, graph)
        ) {
          return item;
        }
        try {
          return await finishOne(item, finisher, graph, upload);
        } catch (err) {
          report(err instanceof Error ? err.message : finisher.failure);
          return item;
        }
      })
    );
  }
  return current;
};
