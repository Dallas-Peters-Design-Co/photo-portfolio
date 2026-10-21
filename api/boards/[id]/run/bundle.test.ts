import { describe, expect, it } from "vitest";
import type { GraphWire } from "../../../../config/graph.js";
import type { BoardItemRow } from "../../../_lib/boards.js";
import { outputsOf, singleOutputOf } from "./outputs.js";

/**
 * A Bundle, read from the run side — the authority on what is sent.
 *
 * The one node with several outputs, so the port a wire leaves from decides
 * what arrives. A Generate node wired to its Images port must get pictures and
 * never the lines of text sitting beside them.
 */
const row = (id: string, fields: Partial<BoardItemRow>): BoardItemRow => ({
  body: null,
  config: {},
  created_at: "",
  credit_name: null,
  credit_url: null,
  height: 10,
  id,
  image_url: null,
  kind: "op",
  photo_id: null,
  thumb_url: null,
  width: 10,
  x: 0,
  y: 0,
  z_index: 0,
  ...fields,
});

const wire = (
  source: string,
  sourcePort: string,
  target: string,
  targetPort: string
): GraphWire => ({
  id: `${source}:${sourcePort}->${target}:${targetPort}`,
  sourceItemId: source,
  sourcePort,
  targetItemId: target,
  targetPort,
});

const A = "https://example.com/a.jpg";
const rows = [
  row("a", { image_url: A, kind: "reference" }),
  row("note", { body: "storm light", kind: "note" }),
  row("bundle", { config: { text: "wide" }, node_type: "bundle" }),
];
const wires = [
  wire("a", "out", "bundle", "images"),
  wire("note", "out", "bundle", "text"),
];
const bundle = rows[2] as BoardItemRow;

describe("outputsOf on a Bundle", () => {
  it("sends pictures out of the Images port", () => {
    expect(outputsOf(bundle, rows, wires, 0, "images")).toEqual([A]);
  });

  it("sends wired then typed lines out of the Text port", () => {
    expect(outputsOf(bundle, rows, wires, 0, "text")).toEqual([
      "storm light",
      "wide",
    ]);
  });

  it("gives pictures to a caller that names no port", () => {
    expect(outputsOf(bundle, rows, wires)).toEqual([A]);
  });

  it("joins its text for a Combine node", () => {
    expect(singleOutputOf(bundle, rows, wires, 0, "text")).toBe(
      "storm light\nwide"
    );
  });
});
