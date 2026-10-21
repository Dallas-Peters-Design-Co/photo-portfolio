import type { BoardItem, BoardWire } from "../types";

/**
 * A Bundle's three stacks, each read off its matching input.
 *
 * Mirrors bundleOutputsOf on the server. A Bundle is the one node with several
 * outputs, but each reader here already asks for one kind — pictures, words or
 * clips — so the kind says which stack, and no reader needs the wire's port.
 */
export const bundleWired = (
  item: BoardItem,
  port: string,
  graph: { items: BoardItem[]; wires: BoardWire[] }
): BoardItem[] =>
  graph.wires
    .filter((w) => w.targetItemId === item.id && w.targetPort === port)
    .map((w) => graph.items.find((i) => i.id === w.sourceItemId))
    .filter((source): source is BoardItem => Boolean(source));
