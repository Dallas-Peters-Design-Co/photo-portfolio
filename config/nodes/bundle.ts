import type { NodeType } from "../nodeTypes.js";

/**
 * Several kinds of thing, gathered once and sent on together.
 *
 * Every other node has one output. That is fine until one Video node wants a
 * start frame, six references and three lines of direction from the same
 * place: three source nodes, three wires each, re-made for every video. A
 * Bundle takes pictures, words and clips in any number and hands each kind out
 * of its own port, so one node feeds the references, the prompt and the source
 * clip of whatever it is wired to.
 *
 * Each output is a stack. The Images port carries every picture in wire order,
 * the Text port every line, the Clips port every clip — a port that takes one
 * keeps the last, the same rule as a second wire on an occupied input.
 *
 * No capability: it passes its inputs along and never costs anything.
 *
 * The output keys are stored in board_wires.source_port, so they are as
 * permanent as any input key. They differ by type, which is what lets each
 * reader resolve the right one without asking which port a wire left from.
 */
export const BUNDLE_IMAGES = "images";
export const BUNDLE_TEXT = "text";
export const BUNDLE_CLIPS = "video";

export const BUNDLE: NodeType = {
  id: "bundle",
  inputs: [
    {
      arity: "many",
      key: BUNDLE_IMAGES,
      label: "Images",
      required: false,
      type: "image",
    },
    {
      arity: "many",
      key: BUNDLE_TEXT,
      label: "Text",
      required: false,
      type: "text",
    },
    {
      arity: "many",
      key: BUNDLE_CLIPS,
      label: "Clips",
      required: false,
      type: "video",
    },
  ],
  label: "Bundle",
  outputs: [
    { key: BUNDLE_IMAGES, label: "Images", type: "image" },
    { key: BUNDLE_TEXT, label: "Text", type: "text" },
    { key: BUNDLE_CLIPS, label: "Clips", type: "video" },
  ],
  settings: [
    {
      // Typed lines join the wired ones, one per line, after them.
      key: "text",
      kind: "text",
      label: "Lines",
      maxLength: 4000,
      placeholder: "one line each — a prompt, a direction, a word…",
    },
  ],
};

/** Enough for a contact sheet; past it a Frame is the better holder. */
export const MAX_BUNDLE_HELD = 48;

/** A list of addresses off a Bundle's config, read defensively and capped. */
const heldList = (config: unknown, key: "clips" | "images"): string[] => {
  const raw = (config as Record<string, unknown> | null)?.[key];
  return Array.isArray(raw)
    ? raw
        .filter((url): url is string => typeof url === "string" && url !== "")
        .slice(0, MAX_BUNDLE_HELD)
    : [];
};

/**
 * The pictures uploaded straight onto a Bundle, as opposed to wired into it.
 *
 * Stored on the node's config as a list of addresses. They follow the wired
 * pictures out of the Images port, so wiring something in later adds to the
 * stack rather than displacing what was uploaded. Read defensively: anything
 * that is not a string is dropped, and the list is capped.
 */
export const bundleHeldImages = (config: unknown): string[] =>
  heldList(config, "images");

/** The clips uploaded onto a Bundle. The same rules, out of the Clips port. */
export const bundleHeldClips = (config: unknown): string[] =>
  heldList(config, "clips");
