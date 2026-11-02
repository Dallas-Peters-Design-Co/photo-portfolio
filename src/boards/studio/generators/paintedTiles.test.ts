import { describe, expect, it } from "vitest";
import { paintedOf, tileAt, withTile } from "./paintedTiles";

describe("painted tiles", () => {
  it("adds, replaces and puts back tiles, ignoring junk", () => {
    let v = withTile("", 3, 4, "#FF0000");
    v = withTile(v, 5, 0, "#00ff0080");
    v = withTile(v, 3, 4, "#0000ff");
    expect(v).toBe("3.4#0000ff,5.0#00ff0080");
    expect(paintedOf(`${withTile(v, 3, 4, null)},nonsense,1.1#zz`)).toEqual(
      new Map([["5.0", "#00ff0080"]])
    );
  });

  it("finds the tile under a point, and nothing off the grid", () => {
    expect(tileAt(150, 250, 400, 400, 4)).toEqual({ col: 1, row: 2 });
    expect(tileAt(-1, 10, 400, 400, 4)).toBeNull();
    expect(tileAt(10, 400, 400, 400, 4)).toBeNull();
  });
});
