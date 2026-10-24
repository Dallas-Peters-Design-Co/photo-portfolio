import type { NodeType } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";

/**
 * A clip brought in from outside: a file dropped on the board, or one pulled
 * off a Video node's results.
 *
 * A node rather than a pinned reference, because what a wire carries is
 * decided by the port it leaves from, and a reference's port says "image" —
 * changing that by sniffing the address would retype wires already saved off
 * every pinned clip, and the save refuses a wire whose types disagree. A Clip
 * says "video" from the registry, so it wires into a Video node's Source clip
 * or a Bundle's Clips with nothing to guess.
 *
 * No capability: it holds a file and never costs anything. The address is
 * kept in config under `clipUrl`, which the save preserves for every node.
 */
export const CLIP: NodeType = {
  id: "clip",
  inputs: [],
  label: "Clip",
  outputs: [{ key: OUTPUT_PORT_KEY, label: "Clip", type: "video" }],
  settings: [],
};

/** The clip a Clip node holds, or null before one is uploaded. */
export const clipUrlOf = (config: unknown): string | null => {
  const raw = (config as { clipUrl?: unknown } | null)?.clipUrl;
  return typeof raw === "string" && raw !== "" ? raw : null;
};

const FILE_EXTENSION = /\.[^.]+$/;

/** What a saved copy is called: the uploaded file's name, without its type. */
export const clipLabelOf = (config: unknown): string => {
  const raw = (config as { name?: unknown } | null)?.name;
  const name = typeof raw === "string" ? raw.replace(FILE_EXTENSION, "") : "";
  return name.trim() || "clip";
};
