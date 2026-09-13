import type { BoardItem } from "../../types";
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
        wiredImageOnPort(itemId, "art", graph),
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
          front: wiredImageOnPort(itemId, "front", graph),
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
        cover: wiredImageOnPort(itemId, "cover", graph),
        wrap: wiredImageOnPort(itemId, "wrap", graph),
      }),
    urlKey: "mockupUrl",
  },
];

/** nodeType → the config key its render lives under. */
export const FINISHER_URL_KEYS: Readonly<Record<string, string>> =
  Object.fromEntries(FINISHERS.map((f) => [f.nodeType, f.urlKey]));

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
