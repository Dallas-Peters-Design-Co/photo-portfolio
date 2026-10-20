import type {
  FalVideoField,
  FalVideoSlot,
} from "../../config/nodes/falVideoInputs.generated.js";
import {
  missingVideoInputs,
  videoInputsFor,
} from "../../config/nodes/falVideoInputs.js";
import { durationValueFor } from "../../config/nodes/videoDuration.js";
import { parsePublicHttpUrl } from "./httpUrl.js";

/**
 * The body a fal video endpoint expects, from what a Video node sends.
 *
 * Pure, so it can be tested without a queue. Getting it wrong is not a
 * rendering bug: fal validates strictly and bills first, so a field the
 * endpoint has never heard of is a 422 on a request already paid for.
 *
 * Field names come from config/nodes/falVideoInputs.generated.ts, which is read
 * from fal's own schemas — the start frame alone has six names across the
 * catalogue. An endpoint that table does not list (one added by hand in the
 * admin) falls back to its row's `image_param`, which is how this worked
 * before the table existed.
 */

/** What arrives in the submit request, unvalidated. */
export interface VideoRequest {
  duration?: unknown;
  imageUrl?: unknown;
  inputs?: unknown;
  prompt?: unknown;
}

/** The wired media, every URL checked to be public http(s). */
export interface VideoMedia {
  end: string | null;
  image: string | null;
  references: string[];
  video: string | null;
}

/** Enough to stop one request from carrying a whole board. */
const MAX_REFERENCES = 16;

const publicUrl = (value: unknown): string | null =>
  typeof value === "string" ? parsePublicHttpUrl(value) : null;

/**
 * The media in a request, validated.
 *
 * `imageUrl` is the old single-picture field, still accepted so a browser tab
 * opened before this deploy can finish its run.
 */
export const readVideoMedia = (body: VideoRequest): VideoMedia => {
  const raw = (
    typeof body.inputs === "object" && body.inputs !== null ? body.inputs : {}
  ) as Record<string, unknown>;
  const references = Array.isArray(raw.references)
    ? raw.references
        .map(publicUrl)
        .filter((url): url is string => url !== null)
        .slice(0, MAX_REFERENCES)
    : [];
  return {
    end: publicUrl(raw.end),
    image: publicUrl(raw.image) ?? publicUrl(body.imageUrl),
    references,
    video: publicUrl(raw.video),
  };
};

/** Why this request cannot be sent to this endpoint, or null when it can. */
export const videoRefusal = (
  model: { id: string; label: string },
  media: VideoMedia,
  prompt: string
): string | null => {
  const missing = missingVideoInputs(model.id, {
    end: Boolean(media.end),
    image: Boolean(media.image),
    prompt: Boolean(prompt),
    references: media.references.length,
    video: Boolean(media.video),
  });
  if (missing.length > 0) {
    return `${model.label} needs ${missing.join(" and ")}.`;
  }
  // Unlisted endpoints: the rule from before the table, one picture or clip.
  if (!(videoInputsFor(model.id) || media.image || media.video)) {
    return "A video node needs a picture or a clip wired into it.";
  }
  return null;
};

const slotValue = (
  slot: FalVideoSlot,
  media: VideoMedia
): string | string[] | null => {
  if (slot === "references") {
    return media.references.length > 0 ? media.references : null;
  }
  return media[slot];
};

/** A list where the endpoint wants one, capped; a single URL where not. */
const shapeFor = (
  spec: FalVideoField,
  value: string | string[]
): string | string[] => {
  if (!spec.list) {
    return Array.isArray(value) ? (value[0] ?? "") : value;
  }
  const list = Array.isArray(value) ? value : [value];
  return spec.max ? list.slice(0, spec.max) : list;
};

/** Puts each wired input under the name this endpoint gives it. */
const mediaFields = (
  modelId: string,
  imageParam: string,
  media: VideoMedia
): Record<string, unknown> => {
  const inputs = videoInputsFor(modelId);
  if (!inputs) {
    const source = media.image ?? media.video;
    return source ? { [imageParam || "image_url"]: source } : {};
  }
  const fields: Record<string, unknown> = {};
  for (const slot of Object.keys(inputs.slots) as FalVideoSlot[]) {
    const spec = inputs.slots[slot];
    const value = slotValue(slot, media);
    if (spec && value) {
      fields[spec.field] = shapeFor(spec, value);
    }
  }
  // A reference model with nothing on its References port but a start frame
  // wired: the frame is the one reference it has, rather than a refusal.
  const refs = inputs.slots.references;
  if (refs && !fields[refs.field] && !inputs.slots.image && media.image) {
    fields[refs.field] = [media.image];
  }
  return fields;
};

export const videoBodyFor = (
  model: { id: string; imageParam: string },
  media: VideoMedia,
  prompt: string,
  duration: string
): Record<string, unknown> => {
  // The length in the endpoint's own vocabulary and its own type, or nothing
  // when it declares no duration. See config/nodes/videoDuration.ts.
  const seconds = duration ? durationValueFor(model.id, duration) : null;
  const takesPrompt = videoInputsFor(model.id)?.prompt !== "none";
  return {
    ...mediaFields(model.id, model.imageParam, media),
    // Only where there is one and the endpoint takes one: an empty or unknown
    // `prompt` is a 422 on the endpoints that declare no such field.
    ...(prompt && takesPrompt ? { prompt } : {}),
    ...(seconds === null ? {} : { duration: seconds }),
  };
};
