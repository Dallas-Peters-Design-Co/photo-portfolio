/**
 * The one output port key, on its own so node definitions can split.
 *
 * It lived in nodeTypes.ts, which is fine until a node type moves into a file
 * of its own: that file needs the key, nodeTypes.ts needs the node, and the two
 * import each other. ES modules allow the cycle but not the timing — the key is
 * declared below the import that triggers it, so the node's file would read it
 * from the temporal dead zone and throw at load, before any of this runs.
 *
 * A leaf module with no imports of its own cannot take part in a cycle.
 */

/** The key of a node's one output — every node but a Bundle, which has three. */
export const OUTPUT_PORT_KEY = "out";
