import { describe, expect, it } from "vitest";
import { anchorsOf, countOf, pathsOfSvg } from "./bezierPaths";

/**
 * Reading a mark's curves out of its own file.
 *
 * A parser that gets a command wrong does not throw — it draws anchors in the
 * wrong place, and the tile still looks like a tile. Every case here is one
 * that a real export produces and that a naive reading gets wrong.
 */

describe("anchorsOf", () => {
  it("reads a simple closed shape", () => {
    const [path] = anchorsOf("M 0 0 L 10 0 L 10 10 Z");
    expect(path.map((a) => [a.x, a.y])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });

  it("keeps both handles of a cubic", () => {
    // The handle before the anchor and the one after belong to different
    // anchors, which is the part that is easy to get backwards.
    const [path] = anchorsOf("M 0 0 C 5 0 10 5 10 10");
    expect(path[0].out).toEqual({ x: 5, y: 0 });
    expect(path[1].in).toEqual({ x: 10, y: 5 });
    expect([path[1].x, path[1].y]).toEqual([10, 10]);
  });

  it("adds the current point for relative commands", () => {
    const [path] = anchorsOf("M 10 10 l 5 5");
    expect([path[1].x, path[1].y]).toEqual([15, 15]);
  });

  it("repeats a command that carries several sets of arguments", () => {
    // "C" with twelve numbers is two curves. A parser that reads one and
    // stops silently loses half the mark.
    const [path] = anchorsOf("M 0 0 C 1 1 2 2 3 3 4 4 5 5 6 6");
    expect(path).toHaveLength(3);
  });

  it("starts a new subpath at every moveto", () => {
    const paths = anchorsOf("M 0 0 L 1 1 M 5 5 L 6 6");
    expect(paths).toHaveLength(2);
  });

  it("takes only the endpoint of an arc", () => {
    // An arc has radii and flags, not handles. Treating its first numbers as
    // coordinates puts anchors somewhere the artwork never went.
    const [path] = anchorsOf("M 0 0 A 5 5 0 0 1 10 10");
    expect([path[1].x, path[1].y]).toEqual([10, 10]);
    expect(path[1].in).toBeUndefined();
  });

  it("leaves an arc's flags alone when it is relative", () => {
    const [path] = anchorsOf("M 10 10 a 5 5 0 0 1 10 10");
    expect([path[1].x, path[1].y]).toEqual([20, 20]);
  });

  it("returns to the subpath start after a close", () => {
    const paths = anchorsOf("M 4 4 L 8 8 Z l 2 2");
    expect([paths[1][0].x, paths[1][0].y]).toEqual([6, 6]);
  });
});

describe("pathsOfSvg", () => {
  it("reads the viewBox so the drawing can be scaled", () => {
    const marks = pathsOfSvg(
      '<svg viewBox="0 0 281 456"><path d="M 0 0 L 1 1"/></svg>'
    );
    expect(marks?.viewBox).toEqual({ height: 456, width: 281 });
  });

  it("collects every path in the file", () => {
    const marks = pathsOfSvg(
      '<svg viewBox="0 0 10 10"><path d="M 0 0 L 1 1"/><path d="M 2 2 L 3 3"/></svg>'
    );
    expect(marks?.paths).toHaveLength(2);
  });

  it("says nothing for artwork that is not vector", () => {
    // The tile prints "this mark is not vector artwork" rather than drawing
    // anchors it does not have.
    expect(pathsOfSvg("\x89PNG\r\n")).toBeNull();
  });
});

describe("countOf", () => {
  it("counts what the tile prints underneath", () => {
    const paths = anchorsOf("M 0 0 C 1 1 2 2 3 3");
    expect(countOf(paths)).toEqual({ handles: 2, paths: 1, points: 2 });
  });
});
