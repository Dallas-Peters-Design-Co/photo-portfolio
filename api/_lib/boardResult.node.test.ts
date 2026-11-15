import { describe, expect, it } from "vitest";
import { withoutResultVersion } from "../../config/resultVersions.js";
import { buildResult, stampProvenance } from "../boards/[id]/run/results.js";
import { updateBoardResult } from "./boardResult.js";

const image = (url: string) => ({
  description: null,
  height: 100,
  isVector: false,
  url,
  width: 100,
});

/** Simulates another request committing between our SELECT and guarded UPDATE. */
const database = (initial: Record<string, unknown> | null) => {
  let result = initial;
  let beforeWrite: (() => void) | null = null;
  let writes = 0;
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (strings.join("").includes("SELECT")) {
      return Promise.resolve([{ result: structuredClone(result) }]);
    }
    const intervene = beforeWrite;
    beforeWrite = null;
    intervene?.();
    const [next, , , , , expected] = values;
    if (JSON.stringify(result) !== (expected ?? "null")) {
      return Promise.resolve([]);
    }
    result = next === null ? null : JSON.parse(String(next));
    writes += 1;
    return Promise.resolve([{ id: "node" }]);
  };
  return {
    interfere: (change: () => void) => {
      beforeWrite = change;
    },
    read: () => result,
    replace: (next: Record<string, unknown> | null) => {
      result = next;
    },
    sql: sql as unknown as Parameters<typeof updateBoardResult>[0],
    writes: () => writes,
  };
};

describe("concurrent node result writes", () => {
  it("does not restore an image deleted while a generation was finishing", async () => {
    const old = { history: [image("removed"), image("kept")], url: "removed" };
    const db = database(old);
    db.interfere(() => db.replace(withoutResultVersion(old, "removed")));
    const result = await updateBoardResult(
      db.sql,
      "board",
      "node",
      (previous) =>
        buildResult(
          { ...image("new"), kind: "image" },
          previous ?? {},
          "fingerprint",
          0,
          1,
          stampProvenance({
            inputs: [],
            model: null,
            prompt: null,
            settings: {},
          })
        )
    );
    expect(result?.history).toEqual([
      image("kept"),
      expect.objectContaining({ url: "new" }),
    ]);
    expect(db.read()).toEqual(result);
    expect(db.writes()).toBe(1);
  });

  it("keeps a concurrent append when removing another image", async () => {
    const old = { history: [image("removed"), image("kept")], url: "removed" };
    const db = database(old);
    db.interfere(() =>
      db.replace({ ...old, history: [...old.history, image("new")] })
    );
    const result = await updateBoardResult(
      db.sql,
      "board",
      "node",
      (previous) => withoutResultVersion(previous, "removed")
    );
    expect(result?.history).toEqual([image("kept"), image("new")]);
    expect(result?.url).toBe("kept");
  });

  it("removes the intended URL after another deletion shifts its index", async () => {
    const old = { history: [image("a"), image("b"), image("c")], url: "a" };
    const db = database(old);
    db.interfere(() => db.replace(withoutResultVersion(old, "a")));
    await updateBoardResult(db.sql, "board", "node", (previous) =>
      withoutResultVersion(previous, "b")
    );
    expect(db.read()?.history).toEqual([image("c")]);
  });

  it("starts a fresh history when the last image was deleted during a save", async () => {
    const db = database({ history: [image("removed")], url: "removed" });
    db.interfere(() => db.replace(null));
    const result = await updateBoardResult(
      db.sql,
      "board",
      "node",
      (previous) => ({
        history: [
          ...(Array.isArray(previous?.history) ? previous.history : []),
          image("new"),
        ],
        url: "new",
      })
    );
    expect(result?.history).toEqual([image("new")]);
  });
});
