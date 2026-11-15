import { withoutResultVersion } from "../../../config/resultVersions";
import type { BoardItem, BoardItemResult } from "../../types";

/**
 * Every run in progress, for every board, owned by the app rather than by the
 * board that started it.
 *
 * Runs are driven from the browser — one request per variation, issued in a
 * loop — and that loop used to live inside the open board's editor. Leaving the
 * board orphaned it: the requests carried on with nothing listening, and coming
 * back showed a node sitting on Ready while it was still being billed. One
 * editor-wide lock also meant one run per board, and in practice one board at a
 * time.
 *
 * Here instead, at module level, so a run outlives the screen it started on:
 *
 * - Each run holds its own AbortController, keyed by board and node. A node
 *   cannot be started twice (the double-click guard the old lock existed for),
 *   but two different nodes, or two boards, run side by side.
 * - Patches for a board are forwarded to whichever editor has that board open,
 *   and remembered — merged per item — while none does. Opening the board
 *   again replays them over what the server returned, so a node still running
 *   says so, and one that finished while you were away shows its new picture.
 *
 * Closing or reloading the tab still ends everything in flight; that needs the
 * runs to live on the server, which this deliberately does not attempt.
 */

type Patch = Partial<BoardItem>;
type Listener = (itemId: string, patch: Patch) => void;

/** The key a whole-board run holds, so nothing else starts on that board. */
export const BOARD_RUN = "*board";

interface BoardRuns {
  controllers: Map<string, AbortController>;
  listener: Listener | null;
  /** Latest merged patch per item, for replay into an editor opened later. */
  live: Map<string, Patch>;
  removedVersions: Map<string, Set<string>>;
}

const boards = new Map<string, BoardRuns>();
const watchers = new Set<() => void>();
/** Bumped on every start and finish, so React can read a stable snapshot. */
let version = 0;

const runsFor = (boardId: string): BoardRuns => {
  let runs = boards.get(boardId);
  if (!runs) {
    runs = {
      controllers: new Map(),
      listener: null,
      live: new Map(),
      removedVersions: new Map(),
    };
    boards.set(boardId, runs);
  }
  return runs;
};

const changed = () => {
  version += 1;
  for (const watcher of watchers) {
    watcher();
  }
};

const isSettled = (patch: Patch | undefined) => patch?.runState !== "running";

const withoutRemovedVersions = (
  runs: BoardRuns,
  itemId: string,
  patch: Patch
): Patch => {
  if (!patch.result) {
    return patch;
  }
  let result: BoardItem["result"] = patch.result;
  for (const url of runs.removedVersions.get(itemId) ?? []) {
    result = withoutResultVersion(result, url);
  }
  return { ...patch, result };
};

export const runStore = {
  /** The open editor for a board starts receiving its patches. */
  attach(boardId: string, listener: Listener): () => void {
    const runs = runsFor(boardId);
    runs.listener = listener;
    return () => {
      if (runs.listener === listener) {
        runs.listener = null;
      }
    };
  },

  /** Stops everything running on one board. */
  cancel(boardId: string): void {
    for (const controller of boards.get(boardId)?.controllers.values() ?? []) {
      controller.abort();
    }
  },

  /** Filters a tool or editor response using confirmed removals. */
  filterPatch(boardId: string, itemId: string, patch: Patch): Patch {
    return withoutRemovedVersions(runsFor(boardId), itemId, patch);
  },

  /** Releases a claim — only the one this controller made. */
  finish(boardId: string, key: string, controller: AbortController): void {
    const runs = boards.get(boardId);
    if (runs?.controllers.get(key) === controller) {
      runs.controllers.delete(key);
      changed();
    }
  },

  /** A late run response or replay must not restore a confirmed deletion. */
  forgetVersion(boardId: string, itemId: string, url: string): void {
    const runs = runsFor(boardId);
    const removed = runs.removedVersions.get(itemId) ?? new Set<string>();
    removed.add(url);
    runs.removedVersions.set(itemId, removed);
    const live = runs.live.get(itemId);
    if (live) {
      runs.live.set(itemId, withoutRemovedVersions(runs, itemId, live));
    }
  },

  isRunning(boardId: string): boolean {
    return (boards.get(boardId)?.controllers.size ?? 0) > 0;
  },

  /** A change to one item, from a run. */
  patch(boardId: string, itemId: string, patch: Patch): void {
    const runs = runsFor(boardId);
    const filtered = withoutRemovedVersions(runs, itemId, patch);
    const merged = { ...runs.live.get(itemId), ...filtered };
    runs.listener?.(itemId, filtered);
    // Delivered and settled: nothing left to replay for this item.
    if (runs.listener && isSettled(merged)) {
      runs.live.delete(itemId);
    } else {
      runs.live.set(itemId, merged);
    }
  },

  /**
   * Hands an editor everything that happened while it was not looking.
   *
   * Called once the board's items have loaded — a patch applied to an empty
   * list is a patch lost. Settled items are then forgotten; ones still running
   * are kept, in case the editor closes again before they finish.
   */
  replay(boardId: string): void {
    const runs = boards.get(boardId);
    if (!runs?.listener) {
      return;
    }
    for (const [itemId, patch] of runs.live) {
      runs.listener(itemId, patch);
      if (isSettled(patch)) {
        runs.live.delete(itemId);
      }
    }
  },

  /** Every board with something in flight. */
  runningBoards(): string[] {
    return [...boards]
      .filter(([, runs]) => runs.controllers.size > 0)
      .map(([id]) => id);
  },
  /**
   * Claims a run, or returns null when it would collide.
   *
   * A node collides with itself and with a whole-board run on its board; a
   * whole-board run collides with anything already running there, since it is
   * about to walk every node.
   */
  start(boardId: string, key: string): AbortController | null {
    const runs = runsFor(boardId);
    const busy =
      key === BOARD_RUN
        ? runs.controllers.size > 0
        : runs.controllers.has(key) || runs.controllers.has(BOARD_RUN);
    if (busy) {
      return null;
    }
    const controller = new AbortController();
    runs.controllers.set(key, controller);
    changed();
    return controller;
  },

  subscribe(watcher: () => void): () => void {
    watchers.add(watcher);
    return () => watchers.delete(watcher);
  },

  version(): number {
    return version;
  },
};

/**
 * Puts a fresh result on an item: drops any version removed while it ran, and
 * selects the newest entry. Without a board there is nothing to filter against.
 */
export const withNewResult = (
  boardId: string | null,
  item: BoardItem,
  next: BoardItemResult | null
): BoardItem => {
  const result = boardId
    ? runStore.filterPatch(boardId, item.id, { result: next }).result
    : next;
  return {
    ...item,
    config: {
      ...item.config,
      selectedVersion: Math.max(0, (result?.history?.length ?? 0) - 1),
    },
    result: result ?? null,
  };
};
