import { type BrandKitDoc, kitPromptText } from "../../config/brandKit.js";
import {
  type FalModelDef,
  falModelFor,
  falModelInput,
  isFalModel,
} from "../../config/falModels.js";
import { describeWithClaude } from "./claudeVision.js";
import { type GeneratedImage, generateImage } from "./fal.js";
import { falAcceptsImageList } from "./falEndpoint.js";

/**
 * A picture for a frame, made from everything the brand kit knows.
 *
 * Two steps. Claude reads the kit — voice, palette, the decisions and
 * feedback in its references, and the on- and off-brand pictures themselves —
 * and turns the request into one image prompt in the brand's look. Then fal
 * makes it at the frame's shape. When the kit has on-brand pictures and the
 * request asks to match them, they go to the model as references too, so the
 * result is held to the photographs and not only to a description of them.
 */

export interface ImageRequest {
  ask: string;
  /** The frame's shape in pixels, for the image's aspect. */
  height: number;
  /**
   * The kit's photo grade, named. The client sends it because the looks are
   * defined in the editor, not on the server.
   */
  look: string;
  /** Send the on-brand pictures to the model as style references. */
  matchPhotos: boolean;
  /**
   * A model from the `models` table, or "" / "auto" for the automatic choice.
   * Checked against the table in brandImage before anything is billed.
   */
  model: string;
  width: number;
}

const MAX_ASK = 600;
const MAX_PROMPT = 1100;
/** On-brand pictures shown to Claude, and sent to the model as references. */
const SHOWN = 6;
const REFERENCES = 3;
const OFF_SHOWN = 2;
const TEXT_TO_IMAGE = /\/(quality\/)?text-to-image$/;

const clampNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
};

export const readImageRequest = (
  body: Record<string, unknown>
): ImageRequest => ({
  ask: typeof body.ask === "string" ? body.ask.trim().slice(0, MAX_ASK) : "",
  height: clampNumber(body.height),
  look: typeof body.look === "string" ? body.look.trim().slice(0, 80) : "",
  matchPhotos: body.matchPhotos !== false,
  model: typeof body.model === "string" ? body.model.trim().slice(0, 200) : "",
  width: clampNumber(body.width),
});

/** fal's nearest named shape to the frame. */
export const imageSizeFor = (width: number, height: number): string => {
  const r = width / height;
  if (r > 1.55) {
    return "landscape_16_9";
  }
  if (r > 1.15) {
    return "landscape_4_3";
  }
  if (r > 0.87) {
    return "square_hd";
  }
  if (r > 0.65) {
    return "portrait_4_3";
  }
  return "portrait_16_9";
};

const SYSTEM = `You write one prompt for an image model, for a picture that goes into a brand's ad or design.
Reply with the prompt only: one paragraph, no preamble, no quotes, under 120 words.
- Follow the request for what the picture shows. Never add products, people, places, claims or numbers it doesn't ask for.
- Match the on-brand pictures first: their medium and technique (painted, printed, drawn, photographed), brushwork or texture, light, colour, composition and mood. Name the medium plainly at the start of the prompt.
- Where the written notes and the on-brand pictures disagree about medium or style, follow the pictures. Notes about past tools, files or experiments are history, not direction.
- Steer clear of what the off-brand pictures show.
- Describe colours in words, never as hex codes.
- No words, letters, logos or watermarks in the picture: type and logo are set over it afterwards.
- Leave calm, uncluttered space where a headline could sit.`;

export const promptBrief = (
  doc: BrandKitDoc,
  req: ImageRequest,
  shown: { off: number; on: number }
): string => {
  const parts = [`Request: ${req.ask || "an image that sums up the brand"}`];
  const said = kitPromptText(doc);
  if (said) {
    parts.push(`Brand: ${said}`);
  }
  if (req.look) {
    parts.push(`Photography is graded with the "${req.look}" look.`);
  }
  const notes = doc.references
    .slice(0, 8)
    .map((r) => `- ${r.title}: ${r.body}`.slice(0, 300));
  if (notes.length > 0) {
    parts.push(`Brand decisions and feedback:\n${notes.join("\n")}`);
  }
  parts.push(`Shape: ${Math.round(req.width)}×${Math.round(req.height)}px.`);
  if (shown.on > 0) {
    parts.push(`The first ${shown.on} picture(s) are on-brand.`);
  }
  if (shown.off > 0) {
    parts.push(
      `The last ${shown.off} picture(s) are OFF-brand: avoid what they do.`
    );
  }
  return parts.join("\n\n");
};

/** The prompt without Claude: the request and the kit's own words. */
const plainPrompt = (doc: BrandKitDoc, req: ImageRequest): string =>
  [
    req.ask || "an image that sums up the brand",
    kitPromptText(doc),
    "no text, no logos",
  ]
    .filter(Boolean)
    .join(", ");

const writePrompt = async (
  doc: BrandKitDoc,
  req: ImageRequest
): Promise<string> => {
  const on = spread(doc.onBrand, SHOWN);
  const off = doc.offBrand.slice(0, OFF_SHOWN);
  try {
    const reply = await describeWithClaude(
      [...on, ...off],
      SYSTEM,
      promptBrief(doc, req, { off: off.length, on: on.length })
    );
    const prompt = reply.trim().replace(/^["']|["']$/g, "");
    return prompt ? prompt.slice(0, MAX_PROMPT) : plainPrompt(doc, req);
  } catch (e) {
    // Claude is a refinement, not a requirement: without it the request and
    // the kit's own description still make a brand-coloured picture.
    console.warn("[brand-kits] image prompt fell back", e);
    return plainPrompt(doc, req);
  }
};

/**
 * Which model makes the picture, and whether it gets the on-brand photos.
 *
 * A model that reads only a prompt still benefits from the photos — Claude
 * looked at them while writing it — but sending them would be ignored or
 * refused, so they're left off. A model that needs a picture is refused when
 * there's none to give it, before the call is billed.
 */
/**
 * `count` pictures taken evenly across the list rather than the first few: a
 * kit often holds the same picture twice (a full and a web copy) side by side,
 * and the first three were then two covers and a duplicate.
 */
export const spread = (list: readonly string[], count: number): string[] => {
  if (list.length <= count) {
    return [...list];
  }
  const step = list.length / count;
  return Array.from(
    { length: count },
    (_, i) => list[Math.floor(i * step)] ?? ""
  ).filter(Boolean);
};

/**
 * The same model's photo-taking endpoint, for a prompt-only model asked to
 * match photos: Nano Banana Pro and GPT Image read only words, while their
 * /edit endpoints take the pictures too. Only one listed in the models table.
 */
export const photoPartner = (
  models: readonly FalModelDef[],
  id: string | null
): string | null => {
  if (!id || falModelInput(models, id) !== "prompt") {
    return null;
  }
  const base = id.replace(TEXT_TO_IMAGE, "");
  const edit = `${base}/edit`;
  return isFalModel(models, edit) ? edit : null;
};

export const imagePlan = (
  doc: BrandKitDoc,
  req: ImageRequest,
  models: readonly FalModelDef[]
): { blend: string[]; model: string | null; source: string | null } => {
  const chosen =
    req.model && req.model !== "auto" && isFalModel(models, req.model)
      ? req.model
      : null;
  const partner =
    req.matchPhotos && doc.onBrand.length > 0
      ? photoPartner(models, chosen)
      : null;
  const model = partner ?? chosen;
  const input = falModelInput(models, model ?? "auto");
  const label = falModelFor(models, model)?.label ?? "That model";
  if (input === "image" || input === "video" || input === "prompt-and-video") {
    throw new Error(`${label} doesn't make pictures from a request`);
  }
  const refs =
    req.matchPhotos && input !== "prompt"
      ? spread(doc.onBrand, REFERENCES)
      : [];
  if (input === "prompt-and-image" && refs.length === 0) {
    throw new Error(
      `${label} reworks a photo: add on-brand photos to the kit and turn on matching`
    );
  }
  const [first, ...rest] = refs;
  const blends =
    first !== undefined &&
    falAcceptsImageList({
      hasSourceImage: true,
      masking: false,
      models,
      requestedModel: model,
    });
  return { blend: blends ? rest : [], model, source: first ?? null };
};

export const brandImage = async (
  doc: BrandKitDoc,
  req: ImageRequest,
  models: readonly FalModelDef[] = []
): Promise<GeneratedImage & { prompt: string }> => {
  const plan = imagePlan(doc, req, models);
  const prompt = await writePrompt(doc, req);
  const image = await generateImage(
    plan.source
      ? `Make a new picture, not a copy of these: they show the brand's style: match their medium, technique and texture. ${prompt}`
      : prompt,
    plan.source,
    plan.model,
    null,
    {
      blendWith: plan.blend,
      palette: doc.palette.map((p) => p.value).slice(0, 6),
      size: imageSizeFor(req.width, req.height),
    }
  );
  return { ...image, prompt };
};
