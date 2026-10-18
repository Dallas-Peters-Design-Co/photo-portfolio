import { describe, expect, it } from "vitest";
import { BOARD_RUN, runStore } from "./runStore";

let n = 0;
/** A board id no other test has touched — the store is module-level. */
const fresh = () => {
  n += 1;
  return `board-${n}`;
};

describe("runStore", () => {
  it("lets different nodes and different boards run at once", () => {
    const a = fresh();
    const b = fresh();
    expect(runStore.start(a, "node-1")).not.toBeNull();
    expect(runStore.start(a, "node-2")).not.toBeNull();
    expect(runStore.start(b, "node-1")).not.toBeNull();
    expect(runStore.runningBoards()).toEqual(expect.arrayContaining([a, b]));
  });

  it("refuses the same node twice — the double-click guard", () => {
    const board = fresh();
    const first = runStore.start(board, "node-1");
    expect(runStore.start(board, "node-1")).toBeNull();
    if (first) {
      runStore.finish(board, "node-1", first);
    }
    expect(runStore.start(board, "node-1")).not.toBeNull();
  });

  it("keeps a whole-board run exclusive on its own board", () => {
    const board = fresh();
    const node = runStore.start(board, "node-1");
    expect(runStore.start(board, BOARD_RUN)).toBeNull();
    if (node) {
      runStore.finish(board, "node-1", node);
    }
    expect(runStore.start(board, BOARD_RUN)).not.toBeNull();
    expect(runStore.start(board, "node-2")).toBeNull();
    expect(runStore.start(fresh(), "node-2")).not.toBeNull();
  });

  it("only releases the claim its own controller made", () => {
    const board = fresh();
    const current = runStore.start(board, "node-1");
    runStore.finish(board, "node-1", new AbortController());
    expect(runStore.isRunning(board)).toBe(true);
    if (current) {
      runStore.finish(board, "node-1", current);
    }
    expect(runStore.isRunning(board)).toBe(false);
  });

  it("cancels every run on one board and none on another", () => {
    const a = fresh();
    const b = fresh();
    const one = runStore.start(a, "node-1");
    const two = runStore.start(a, "node-2");
    const other = runStore.start(b, "node-1");
    runStore.cancel(a);
    expect(one?.signal.aborted).toBe(true);
    expect(two?.signal.aborted).toBe(true);
    expect(other?.signal.aborted).toBe(false);
  });

  it("forwards patches to the open editor", () => {
    const board = fresh();
    const seen: string[] = [];
    runStore.attach(board, (id, patch) => seen.push(`${id}:${patch.runState}`));
    runStore.patch(board, "node-1", { runState: "running" });
    runStore.patch(board, "node-1", { runState: "succeeded" });
    expect(seen).toEqual(["node-1:running", "node-1:succeeded"]);
  });

  it("remembers what happened while no editor was open, and replays it once", () => {
    const board = fresh();
    const detach = runStore.attach(board, () => undefined);
    runStore.patch(board, "node-1", { runState: "running" });
    detach();
    runStore.patch(board, "node-1", { result: null, runState: "succeeded" });
    runStore.patch(board, "node-2", { runState: "running" });

    const seen: Record<string, string | null | undefined> = {};
    runStore.attach(board, (id, patch) => {
      seen[id] = patch.runState;
    });
    runStore.replay(board);
    expect(seen).toEqual({ "node-1": "succeeded", "node-2": "running" });

    // Settled ones are forgotten; the one still running is kept.
    const again: string[] = [];
    runStore.attach(board, (id) => again.push(id));
    runStore.replay(board);
    expect(again).toEqual(["node-2"]);
  });

  it("does nothing on replay with no editor attached", () => {
    const board = fresh();
    runStore.patch(board, "node-1", { runState: "succeeded" });
    expect(() => runStore.replay(board)).not.toThrow();
  });
});
