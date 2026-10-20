import type { NodeType, SettingDef } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";

/**
 * Animating a still.
 *
 * Its own file because it is the first node whose work does not finish inside
 * the request that asks for it. An image comes back in seconds; a few seconds
 * of footage is one to five minutes, which is past both the fal request timeout
 * and the serverless function's own ceiling. So a video is submitted to fal's
 * queue and polled from the browser — see api/_lib/falQueue.ts for why the
 * polling lives there rather than on the server.
 *
 * Image-to-video rather than text-to-video, first, because a moodboard is
 * already full of pictures: the interesting question here is "what would this
 * look like moving", and the answer needs the picture. A text-only video node
 * would be a Generate node with a different output type and no reason to sit
 * beside the images it is not using.
 */

/** Seconds of footage. Every endpoint bills by duration, so this is the price. */
const DURATION: SettingDef = {
  default: "5",
  key: "duration",
  kind: "select",
  label: "Seconds",
  // Written as strings because a select's value is a string everywhere else in
  // this registry, and one numeric select would be the only one to parse.
  options: ["5", "10"],
};

/**
 * How the frame moves, in words.
 *
 * Separate from the subject prompt on purpose. Every video endpoint takes one
 * prompt, but the two halves are written differently — "a slow push in, handheld"
 * is direction, and mixing it into a description of what is in the shot is how
 * a camera move ends up drawn as an object in the scene.
 */
const MOTION: SettingDef = {
  key: "motion",
  kind: "text",
  label: "Camera",
  maxLength: 400,
  placeholder: "a slow push in, handheld…",
};

export const VIDEO: NodeType = {
  capability: "fal.video",
  id: "video",
  inputs: [
    {
      // The start frame. One, because a clip has one first frame — a second
      // wire is someone changing their mind and replaces the first.
      //
      // Not required here any more: text-to-video endpoints take no picture at
      // all, and whether this one is needed depends on the model chosen. That
      // is checked at run time against what the endpoint declares — see
      // missingVideoInputs — and refused before anything is spent.
      arity: "one",
      key: "image",
      label: "Start frame",
      required: false,
      type: "image",
    },
    {
      arity: "one",
      key: "end",
      label: "End frame",
      required: false,
      type: "image",
    },
    {
      // Many, which is what lets a Frame, a Batch or a handful of photos feed
      // one clip: the endpoints that take several pictures treat them as the
      // subject's references, not as separate jobs.
      arity: "many",
      key: "references",
      label: "References",
      required: false,
      type: "image",
    },
    {
      arity: "one",
      key: "video",
      label: "Source clip",
      required: false,
      type: "video",
    },
    {
      arity: "many",
      key: "prompt",
      label: "Prompt",
      required: false,
      type: "text",
    },
  ],
  label: "Video",
  // A video, not an image. The port type is what stops it being wired into a
  // Generate node that would hand an mp4 to an image model and be billed for
  // the refusal.
  outputs: [{ key: OUTPUT_PORT_KEY, label: "Video", type: "video" }],
  settings: [
    {
      key: "prompt",
      kind: "text",
      label: "Prompt",
      maxLength: 1200,
      placeholder: "what should happen…",
    },
    MOTION,
    {
      default: "auto",
      key: "model",
      kind: "model",
      label: "Model",
      // Filtered to the rows whose capability is video: an image endpoint
      // handed a video request fails after it has been billed.
      video: true,
    },
    DURATION,
  ],
};
