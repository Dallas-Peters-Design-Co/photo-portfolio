import type { BrandKitDoc } from "../../config/brandKit.js";
import { describeWithClaude } from "./claudeVision.js";

/**
 * Ad copy in a brand's voice: three variants from a brief, or the current
 * copy translated. Written by Claude with the kit's voice, references and
 * on-brand pictures as context, and returned as plain JSON the creative
 * editor drops into the headline, body and call to action.
 */

export interface CopySet {
  /** One line on the angle this variant takes. */
  angle: string;
  body: string;
  cta: string;
  headline: string;
}

export interface CopyRequest {
  brief: string;
  current: Omit<CopySet, "angle">;
  /** Target language name, e.g. "Deutsch". Empty keeps the brand's. */
  language: string;
  /** "1080×1920" — shorter copy for smaller ads. */
  size: string;
}

const clamp = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const readCopyRequest = (body: Record<string, unknown>): CopyRequest => {
  const current = (body.current ?? {}) as Record<string, unknown>;
  return {
    brief: clamp(body.brief, 1200),
    current: {
      body: clamp(current.body, 600),
      cta: clamp(current.cta, 80),
      headline: clamp(current.headline, 200),
    },
    language: clamp(body.language, 40),
    size: clamp(body.size, 20),
  };
};

const SYSTEM = `You write display ad copy for a brand. Reply with JSON only, no prose, no code fences:
{"variants":[{"angle":"","headline":"","body":"","cta":""}]}
Rules:
- Write in the brand's voice exactly as described. Never invent claims, prices, numbers or offers that are not in the brief or the current copy.
- Headline: at most 7 words. Body: at most 18 words. CTA: 2 to 4 words, a verb first.
- Each variant takes a clearly different angle; "angle" says which in under 8 words.
- No emoji, no hashtags, no exclamation marks unless the voice asks for them.`;

const prompt = (doc: BrandKitDoc, req: CopyRequest): string => {
  const parts = [
    `Brand voice:\n${doc.voice || "(not stated; keep it plain and confident)"}`,
  ];
  const notes = doc.references
    .slice(0, 8)
    .map((r) => `- ${r.title}: ${r.body}`.slice(0, 400));
  if (notes.length > 0) {
    parts.push(`Brand decisions and feedback:\n${notes.join("\n")}`);
  }
  if (req.size) {
    parts.push(`Ad size: ${req.size}px.`);
  }
  const { body, cta, headline } = req.current;
  if (headline || body || cta) {
    parts.push(
      `Current copy:\nHeadline: ${headline}\nBody: ${body}\nCTA: ${cta}`
    );
  }
  if (req.brief) {
    parts.push(`Brief:\n${req.brief}`);
    parts.push(`Write 3 variants${req.language ? ` in ${req.language}` : ""}.`);
  } else if (req.language) {
    parts.push(
      `Translate the current copy into ${req.language}, keeping the voice and the lengths. Return 1 variant with angle "${req.language}".`
    );
  } else {
    parts.push("Write 3 fresh variants of the current copy.");
  }
  if (doc.onBrand.length > 0) {
    parts.push("The pictures show the brand's look; let them inform tone.");
  }
  return parts.join("\n\n");
};

/** The variants out of a model reply, tolerating fences or stray prose. */
export const parseVariants = (text: string): CopySet[] => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return [];
  }
  try {
    const json = JSON.parse(text.slice(start, end + 1)) as {
      variants?: Record<string, unknown>[];
    };
    return (json.variants ?? [])
      .map((v) => ({
        angle: clamp(v.angle, 80),
        body: clamp(v.body, 300),
        cta: clamp(v.cta, 40),
        headline: clamp(v.headline, 120),
      }))
      .filter((v) => v.headline)
      .slice(0, 3);
  } catch {
    return [];
  }
};

export const writeCopy = async (
  doc: BrandKitDoc,
  req: CopyRequest
): Promise<CopySet[]> => {
  const reply = await describeWithClaude(
    doc.onBrand.slice(0, 3),
    SYSTEM,
    prompt(doc, req)
  );
  const variants = parseVariants(reply);
  if (variants.length === 0) {
    throw new Error("The copy came back in a shape the editor can't use");
  }
  return variants;
};
