import {
  FAL_VIDEO_INPUTS,
  type FalVideoInputs,
  type FalVideoSlot,
} from "./falVideoInputs.generated.js";

/**
 * What a Video node may send to the endpoint it has chosen.
 *
 * Policy over the generated table, kept apart for the usual reason: a wrong
 * answer is not a rendering bug, it is a 422 on a request already billed. So
 * the run is refused *before* it is sent when the wiring cannot satisfy the
 * endpoint, and the refusal says which input is missing.
 */

/** What is wired to the node right now. */
export interface WiredVideoInputs {
  end?: boolean;
  image?: boolean;
  prompt?: boolean;
  references?: number;
  video?: boolean;
}

const SLOT_LABELS: Record<FalVideoSlot, string> = {
  end: "an end frame",
  image: "a start frame",
  references: "reference images",
  video: "a source clip",
};

/** The table's entry for an endpoint, or null for one it does not list. */
export const videoInputsFor = (modelId: unknown): FalVideoInputs | null =>
  typeof modelId === "string"
    ? ((FAL_VIDEO_INPUTS as Record<string, FalVideoInputs>)[modelId] ?? null)
    : null;

const isWired = (slot: FalVideoSlot, wired: WiredVideoInputs): boolean => {
  if (slot === "references") {
    return (wired.references ?? 0) > 0;
  }
  return Boolean(wired[slot]);
};

/**
 * The required inputs that nothing is wired to, as phrases for a sentence.
 *
 * Empty means the run may go ahead. An endpoint the table does not list is not
 * judged here: its row's `input` shape already covers it.
 */
export const missingVideoInputs = (
  modelId: unknown,
  wired: WiredVideoInputs
): string[] => {
  const inputs = videoInputsFor(modelId);
  if (!inputs) {
    return [];
  }
  const missing: string[] = [];
  for (const slot of Object.keys(inputs.slots) as FalVideoSlot[]) {
    if (inputs.slots[slot]?.required && !isWired(slot, wired)) {
      missing.push(SLOT_LABELS[slot]);
    }
  }
  if (inputs.prompt === "required" && !wired.prompt) {
    missing.push("a prompt");
  }
  return missing;
};

const SLOT_NAMES: Record<FalVideoSlot, string> = {
  end: "end frame",
  image: "start frame",
  references: "references",
  video: "source clip",
};

/**
 * What the chosen endpoint takes, as one line for the node.
 *
 * Every Video node draws all five ports, and most endpoints use two of them.
 * Without this the only way to learn that a model ignores the end frame, or
 * needs one, was to run it — and a video is the expensive thing to run.
 */
export const videoInputsNote = (modelId: unknown): string | null => {
  const inputs = videoInputsFor(modelId);
  if (!inputs) {
    return null;
  }
  const parts = (Object.keys(inputs.slots) as FalVideoSlot[]).map((slot) => {
    const spec = inputs.slots[slot];
    const name =
      slot === "references" && spec?.max
        ? `up to ${spec.max} references`
        : SLOT_NAMES[slot];
    return spec?.required ? `${name} (required)` : name;
  });
  if (inputs.prompt !== "none") {
    parts.push(inputs.prompt === "required" ? "prompt (required)" : "prompt");
  }
  return parts.length > 0 ? `Takes ${parts.join(", ")}.` : null;
};
