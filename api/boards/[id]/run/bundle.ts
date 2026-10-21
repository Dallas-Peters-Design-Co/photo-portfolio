import type { GraphWire } from "../../../../config/graph.js";
import {
  BUNDLE_IMAGES,
  BUNDLE_TEXT,
  bundleHeldImages,
} from "../../../../config/nodes/bundle.js";
import type { BoardItemRow } from "../../../_lib/boards.js";
import { asObject, listRowsOf, MAX_JOIN_DEPTH } from "./rows.js";

type Resolve = (
  row: BoardItemRow,
  rows: BoardItemRow[],
  wires: GraphWire[],
  depth: number,
  port?: string
) => string[];

/**
 * What one of a Bundle's ports carries: everything wired into the matching
 * input, in wire order, and on the Text port the typed lines after them.
 *
 * Keyed by port: the one node with several outputs. A wire naming no port
 * gets the pictures.
 */
export const bundleOutputsOf = (
  row: BoardItemRow,
  rows: BoardItemRow[],
  wires: GraphWire[],
  depth: number,
  port: string | undefined,
  /**
   * outputsOf, handed in rather than imported: it calls this, and a module
   * cycle between the two would load one of them half-initialised.
   */
  resolve: Resolve
): string[] => {
  const key = port ?? BUNDLE_IMAGES;
  if (depth > MAX_JOIN_DEPTH) {
    return [];
  }
  const wired = wires
    .filter((wire) => wire.targetItemId === row.id && wire.targetPort === key)
    .flatMap((wire) => {
      const source = rows.find(
        (candidate) => candidate.id === wire.sourceItemId
      );
      return source
        ? resolve(source, rows, wires, depth + 1, wire.sourcePort)
        : [];
    });
  if (key === BUNDLE_IMAGES) {
    return [...wired, ...bundleHeldImages(row.config)];
  }
  return key === BUNDLE_TEXT
    ? [...wired, ...listRowsOf(asObject(row.config).text)]
    : wired;
};
