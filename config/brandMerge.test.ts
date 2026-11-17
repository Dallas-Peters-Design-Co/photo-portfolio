import { describe, expect, it } from "vitest";
import { cleanBrandMerge } from "./brandMerge.js";

describe("a merge's pictures from a collection", () => {
  it("keeps the collection it reads from, and drops one that isn't an id", () => {
    const id = "3f2c1a00-1b2c-4d3e-8f90-112233445566";
    expect(cleanBrandMerge({ collectionId: id })?.collectionId).toBe(id);
    expect(cleanBrandMerge({ collectionId: "nope" })?.collectionId).toBeNull();
  });
});
