import { describe, expect, it, vi } from "vitest";
import {
  cleanLookEdit,
  cleanLookName,
  deleteLook,
  MAX_SAVED_LOOKS,
  saveLook,
} from "../_lib/savedLooks.js";

/** A tagged-template stand-in for the sql client that records each query. */
const fakeSql = (answers: unknown[][]) => {
  const calls: string[] = [];
  const sql = vi.fn((strings: TemplateStringsArray) => {
    calls.push(strings.join("?"));
    return Promise.resolve(answers.shift() ?? []);
  });
  return { calls, sql: sql as never };
};

const row = {
  edit: { contrast: 0.2 },
  id: "11111111-1111-1111-1111-111111111111",
  name: "Bird Creek Warm",
  updated_at: "2026-11-01T00:00:00.000Z",
};

describe("cleanLookEdit", () => {
  it("keeps a plain edit", () => {
    expect(
      cleanLookEdit({ contrast: 0.2, hsl: [{ h: 0 }], splitShadow: { r: 0.1 } })
    ).toEqual({
      contrast: 0.2,
      hsl: [{ h: 0 }],
      splitShadow: { r: 0.1 },
    });
  });

  it("refuses arrays, non-finite numbers, and anything huge", () => {
    expect(cleanLookEdit([1, 2])).toBeNull();
    expect(cleanLookEdit({ contrast: Number.NaN })).toBeNull();
    expect(cleanLookEdit({ blob: "x".repeat(25_000) })).toBeNull();
    expect(cleanLookEdit(null)).toBeNull();
  });
});

describe("saveLook", () => {
  it("needs a name and a usable edit", async () => {
    const { sql } = fakeSql([]);
    expect(await saveLook(sql, { edit: { a: 1 }, name: "  " })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await saveLook(sql, { edit: "nope", name: "Warm" })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("creates a new look", async () => {
    const { sql, calls } = fakeSql([[{ n: 3 }], [row]]);
    const out = await saveLook(sql, {
      action: "saveLook",
      edit: { contrast: 0.2 },
      name: "Bird Creek Warm",
    });
    expect(out).toMatchObject({
      look: { id: row.id, name: "Bird Creek Warm" },
      ok: true,
      status: 201,
    });
    expect(calls[1]).toContain("INSERT INTO saved_looks");
  });

  it("replaces a look by id", async () => {
    const { sql, calls } = fakeSql([[row]]);
    const out = await saveLook(sql, {
      edit: { contrast: 0.2 },
      id: row.id,
      name: "Renamed",
    });
    expect(out).toMatchObject({ ok: true, status: 200 });
    expect(calls[0]).toContain("UPDATE saved_looks");
  });

  it("stops at the limit", async () => {
    const { sql } = fakeSql([[{ n: MAX_SAVED_LOOKS }]]);
    expect(
      await saveLook(sql, { edit: { a: 1 }, name: "One more" })
    ).toMatchObject({ ok: false, status: 409 });
  });
});

describe("names and deletes", () => {
  it("trims and caps names", () => {
    expect(cleanLookName(`  ${"x".repeat(80)}`)).toHaveLength(60);
    expect(cleanLookName(5)).toBe("");
  });

  it("only deletes by a real id", async () => {
    const { sql, calls } = fakeSql([]);
    await deleteLook(sql, "not-an-id");
    expect(calls).toHaveLength(0);
    await deleteLook(sql, row.id);
    expect(calls[0]).toContain("DELETE FROM saved_looks");
  });
});
