import { describe, expect, it } from "vitest";
import { resultVersions, withoutResultVersion } from "./resultVersions";

describe("removing result versions", () => {
  it("clears the last version rather than falling back to a stale batch", () => {
    expect(
      withoutResultVersion(
        { history: [{ url: "a" }], url: "a", variations: [{ url: "a" }] },
        "a"
      )
    ).toBeNull();
  });

  it("supports legacy batch and single-image results", () => {
    expect(
      withoutResultVersion(
        { url: "a", variations: [{ url: "a" }, null, { url: "b" }] },
        "a"
      )
    ).toMatchObject({ history: [{ url: "b" }], url: "b", variations: [] });
    expect(withoutResultVersion({ url: "a" }, "a")).toBeNull();
  });

  it("does not recover old URLs from an intentionally empty history", () => {
    expect(
      resultVersions({
        history: [],
        url: "stale",
        variations: [{ url: "stale" }],
      })
    ).toEqual([]);
  });

  it("does not mutate the old result or affect an unrelated deletion", () => {
    const previous = { history: [{ url: "a" }, { url: "b" }], url: "a" };
    expect(withoutResultVersion(previous, "missing")).toBe(previous);
    expect(withoutResultVersion(previous, "a")?.history).toEqual([
      { url: "b" },
    ]);
    expect(previous.history).toHaveLength(2);
  });
});
