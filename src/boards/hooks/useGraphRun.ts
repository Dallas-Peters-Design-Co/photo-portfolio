import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  descendantsOf,
  type GraphItem,
  type GraphWire,
  topologicalOrder,
} from "../../../config/graph.js";
import { isRunnableNodeType } from "../../../config/nodeTypes.js";
import { useAutoRun } from "../../components/admin/boardEditor/useAutoRun";
import {
  boardsApi,
  type RunNodeFailure,
  type RunNodeResponse,
} from "../../services/portfolioService";
import type { BoardItem, BoardWire } from "../../types";
import { BOARD_RUN, runStore } from "../run/runStore";
import { useBoardIsRunning } from "../run/useRunStore";

interface UseGraphRunArgs {
  /** Flushes unsaved work first — the server runs the *stored* graph. */
  beforeRun: () => Promise<void>;
  boardId: string;
  items: BoardItem[];
  onPatch: (itemId: string, patch: Partial<BoardItem>) => void;
  /**
   * How to run a Video node, which this runner cannot.
   *
   * A board run walks every node itself, so the fork that the single-node Run
   * button makes in `useVideoNode` never applied here: a board containing a
   * Video node ran it through the image endpoint and was billed for the
   * refusal. Handed in rather than imported so this file keeps knowing nothing
   * about fal's queue. See src/boards/hooks/useVideoNode.ts.
   */
  runVideo?: (itemId: string) => Promise<void>;
  wires: BoardWire[];
}

const toGraphItems = (items: BoardItem[]): GraphItem[] =>
  items.map((item) => ({
    id: item.id,
    kind: item.kind,
    nodeType: item.nodeType,
  }));

const toGraphWires = (wires: BoardWire[]): GraphWire[] => wires;

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

/** Where a batch run's failures and discovered size accumulate. */
interface RunContext {
  failed: string[];
  total: number;
}

/**
 * One variation of a batch, or null when it failed.
 *
 * A failure is remembered rather than thrown: each job is an independent paid
 * generation, so a model stumbling on one should not sink the rest. The batch
 * size travels with a failed first job — the only case the size is not already
 * known — so the caller can keep going.
 */
const runOneVariation = async (
  boardId: string,
  itemId: string,
  force: boolean,
  variation: number,
  context: RunContext,
  signal?: AbortSignal
): Promise<RunNodeResponse | null> => {
  try {
    return await boardsApi.runNode(boardId, itemId, {
      force,
      variation,
      ...(signal ? { signal } : {}),
    });
  } catch (e) {
    if (isAbort(e)) {
      throw e;
    }
    context.failed.push(
      e instanceof Error ? e.message : "This image failed to generate"
    );
    const count = (e as RunNodeFailure).variationCount;
    if (typeof count === "number") {
      context.total = count;
    }
    return null;
  }
};

/**
 * Runs a node's batch, variation by variation, until each job has settled.
 *
 * The newest completed image is shown while the next job runs, so a batch of
 * eight visibly fills instead of looking hung for ten minutes. Failed jobs are
 * remembered rather than stopping the run — each is an independent paid
 * generation, and a flaky upstream model on one picture must not cost the rest.
 */
const runBatch = async (
  boardId: string,
  itemId: string,
  force: boolean,
  onPatch: (itemId: string, patch: Partial<BoardItem>) => void,
  signal?: AbortSignal
): Promise<{ failed: string[]; outcome: RunNodeResponse | null }> => {
  const context: RunContext = { failed: [], total: 1 };
  let outcome = await runOneVariation(
    boardId,
    itemId,
    force,
    0,
    context,
    signal
  );
  if (outcome) {
    context.total = outcome.variationCount ?? 1;
    reportSkipped(outcome.skippedVectors ?? 0);
  }
  if (outcome?.skipped !== true) {
    for (let variation = 1; variation < context.total; variation += 1) {
      if (signal?.aborted) {
        break;
      }
      if (outcome) {
        onPatch(itemId, { result: outcome.result });
      }
      // biome-ignore lint/performance/noAwaitInLoops: one generation per request is the whole point — see the note above
      const next = await runOneVariation(
        boardId,
        itemId,
        force,
        variation,
        context,
        signal
      );
      if (next) {
        outcome = next;
      }
    }
  }
  return { failed: context.failed, outcome };
};

/**
 * Says out loud that a batch lost some jobs but kept the rest.
 *
 * The same rule as the skipped-vector count: a run that quietly lost a job
 * looks like it worked, when a node with two of its four pictures is not a
 * success.
 */
/**
 * What to say about the jobs that did not survive.
 *
 * The count alone is not actionable, and that is all this used to say: "one
 * image in the batch failed" names a number and withholds the only part worth
 * knowing. The reasons were sitting in the array being counted. A batch mostly
 * fails for one reason, so the distinct ones are listed rather than the
 * occurrences — five copies of the same sentence is not five pieces of
 * information — and the first two are enough to act on.
 */
export const batchFailureMessage = (
  failed: string[]
): { description: string; title: string } | null => {
  if (failed.length === 0) {
    return null;
  }
  const reasons = [...new Set(failed.map((f) => f.trim()).filter(Boolean))];
  return {
    description: reasons.slice(0, 2).join(" · ") || "No reason was given.",
    title:
      failed.length === 1
        ? "One image in the batch failed — the rest came back."
        : `${failed.length} images in the batch failed — the rest came back.`,
  };
};

const reportBatchFailures = (failed: string[]): void => {
  const said = batchFailureMessage(failed);
  if (said) {
    toast.warning(said.title, { description: said.description });
  }
};

interface StepArgs {
  doomed: Set<string>;
  graphWires: GraphWire[];
  id: string;
  isRunnable: boolean;
  onPatch: (itemId: string, patch: Partial<BoardItem>) => void;
  runOne: (itemId: string) => Promise<unknown>;
}

/**
 * Runs one node in a board run. Returns false when the whole run should stop.
 *
 * A node failing is not a reason to stop: the rest of the board may be entirely
 * independent of it. Only an abort ends the run. Everything downstream of the
 * failure is marked instead, and never asked for.
 */
const runStep = async ({
  doomed,
  graphWires,
  id,
  isRunnable,
  onPatch,
  runOne,
}: StepArgs): Promise<boolean> => {
  if (!isRunnable) {
    return true;
  }
  if (doomed.has(id)) {
    // Marked without a request being sent: a failure upstream must not spend
    // money on the nodes that depended on it.
    onPatch(id, { runState: "skipped" });
    return true;
  }
  try {
    await runOne(id);
  } catch (e) {
    if (isAbort(e)) {
      return false;
    }
    const message = e instanceof Error ? e.message : "Could not run this node";
    onPatch(id, { runError: message, runState: "failed" });
    for (const downstream of descendantsOf(graphWires, id)) {
      doomed.add(downstream);
    }
  }
  return true;
};

/**
 * Runs a board's nodes in dependency order, from the browser.
 *
 * Orchestration lives here rather than on the server because a single
 * generation already budgets close to two minutes against a serverless ceiling,
 * so a graph cannot execute inside one request. One request per node, issued
 * from the page that is watching them, gives instant per-node feedback with no
 * polling channel and no job store.
 *
 * The cost, stated plainly: closing the tab abandons whatever has not started.
 * Nothing already paid for is lost, because each node's result is committed by
 * its own request before the next one begins.
 */
/**
 * Says out loud what a batch quietly declined to run.
 *
 * A frame carrying one vectorised logo among its stickers runs the stickers and
 * drops the vector; the same goes for a picture whose address cannot be
 * fetched. Either way a batch that silently does fewer jobs than you asked for
 * is worse than one that fails outright.
 */
const reportSkipped = (dropped: number): void => {
  if (dropped <= 0) {
    return;
  }
  toast.warning(
    dropped === 1
      ? "One image was skipped — a vector, or an address that cannot be read."
      : `${dropped} images were skipped — vectors, or addresses that cannot be read.`
  );
};

export function useGraphRun({
  beforeRun,
  boardId,
  items,
  onPatch,
  runVideo,
  wires,
}: UseGraphRunArgs) {
  const [error, setError] = useState<string | null>(null);
  // From the app-wide store, not this editor: a run started here keeps going,
  // and keeps reporting, after the board is closed. See runStore.
  const isRunning = useBoardIsRunning(boardId);

  // Patches go through the store, which hands them to whichever editor has
  // this board open — this one now, a later one if it is closed and reopened.
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  useEffect(
    () =>
      runStore.attach(boardId, (itemId, patch) =>
        onPatchRef.current(itemId, patch)
      ),
    [boardId]
  );
  // Once the board has loaded, catch up on whatever ran while it was closed.
  const loaded = items.length > 0;
  useEffect(() => {
    if (loaded) {
      runStore.replay(boardId);
    }
  }, [boardId, loaded]);
  const emit = useCallback(
    (itemId: string, patch: Partial<BoardItem>) =>
      runStore.patch(boardId, itemId, patch),
    [boardId]
  );

  /** Stops everything running on this board. */
  const cancel = useCallback(() => runStore.cancel(boardId), [boardId]);

  /**
   * Runs one node to completion, variation by variation.
   *
   * A batch is several paid generations, and each one has to be its own request
   * for the same reason each node does: one generation already fills most of a
   * function's time budget. The first response reports how many there are, so
   * the count comes from the server rather than being recomputed here from
   * settings the server may have clamped.
   *
   * A failed variation does not stop the rest — these are independent paid
   * generations. The failures are counted and reported when the run settles;
   * the node is only marked failed when every job failed.
   */
  const runOne = useCallback(
    async (itemId: string, force: boolean, signal?: AbortSignal) => {
      emit(itemId, { runError: null, runState: "running" });

      const { failed, outcome } = await runBatch(
        boardId,
        itemId,
        force,
        emit,
        signal
      );
      reportBatchFailures(failed);

      // Nothing survived: the node is genuinely broken this run.
      if (!outcome) {
        throw new Error(failed[0] ?? "This node could not run");
      }

      emit(itemId, {
        result: outcome.result,
        runError: outcome.runError,
        runState: outcome.runState,
      });
      return outcome;
    },
    [boardId, emit]
  );

  /**
   * A single node, run on its own from the node's own control.
   *
   * Claimed per node, so a second click on the same node is ignored (each
   * would be a fresh paid generation) while other nodes, and other boards, can
   * run alongside it.
   */
  const runNode = useCallback(
    async (itemId: string, force: boolean) => {
      const controller = runStore.start(boardId, itemId);
      if (!controller) {
        return;
      }
      // Marked running before the preparation below: beforeRun renders masks
      // and composites and can take seconds, and a node sitting on READY after
      // being told to run reads as a click that did not land.
      emit(itemId, { runError: null, runState: "running" });
      try {
        await beforeRun();
        await runOne(itemId, force, controller.signal);
      } catch (e) {
        // An abort is a choice, not a failure.
        if (controller.signal.aborted) {
          emit(itemId, { runError: null, runState: "idle" });
        } else {
          const message =
            e instanceof Error ? e.message : "Could not run this node";
          emit(itemId, { runError: message, runState: "failed" });
        }
      } finally {
        runStore.finish(boardId, itemId, controller);
      }
    },
    [beforeRun, boardId, emit, runOne]
  );

  /**
   * Every node on the board, in dependency order.
   *
   * Sequential rather than parallel across independent branches: two nodes at
   * once would double the peak spend against rate-limited services. Exclusive
   * on its board — it is about to walk every node — but not across boards.
   */
  const runBoard = useCallback(async () => {
    setError(null);
    const graphItems = toGraphItems(items);
    const graphWires = toGraphWires(wires);

    const ordered = topologicalOrder(graphItems, graphWires);
    if (!ordered.order) {
      setError("Those connections form a loop, which cannot run.");
      return;
    }

    const controller = runStore.start(boardId, BOARD_RUN);
    if (!controller) {
      return;
    }

    try {
      await beforeRun();
    } catch {
      runStore.finish(boardId, BOARD_RUN, controller);
      return;
    }

    // Everything downstream of a failure, accumulated as failures happen. A
    // node in here is marked skipped without a request being sent, so one
    // failure never spends money on the nodes that depended on it.
    const doomed = new Set<string>();
    const byId = new Map(items.map((item) => [item.id, item]));

    try {
      for (const id of ordered.order) {
        if (controller.signal.aborted) {
          break;
        }
        // biome-ignore lint/performance/noAwaitInLoops: dependency order is the point — a node cannot start before the one feeding it has finished
        const carryOn = await runStep({
          doomed,
          graphWires,
          id,
          // Source nodes — Prompt, Join, Iterate, Palette — hold a value rather
          // than producing one, and asking the endpoint to run one only earns a
          // refusal that dooms everything downstream. Ask the board instead.
          isRunnable: isRunnableNodeType(byId.get(id)?.nodeType),
          onPatch: emit,
          // A Video node takes its own road; the image endpoint would bill for
          // the refusal.
          runOne: (nodeId) =>
            byId.get(nodeId)?.nodeType === "video" && runVideo
              ? runVideo(nodeId)
              : runOne(nodeId, false, controller.signal),
        });
        if (!carryOn) {
          break;
        }
      }
    } finally {
      runStore.finish(boardId, BOARD_RUN, controller);
    }
  }, [beforeRun, boardId, emit, items, runOne, runVideo, wires]);

  // ?run=1 in the URL runs the board once, as soon as it has something to
  // run. Here rather than in BoardEditor because this hook already owns
  // runBoard and isRunning, and that component is on the line limit.
  useAutoRun({ isRunning, items, runBoard });

  return { cancel, error, isRunning, runBoard, runNode };
}
