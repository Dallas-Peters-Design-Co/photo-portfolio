import type { BrandKitDoc } from "../../config/brandKit.js";
import {
  type BrandMerge,
  cleanBrandMerge,
  MAX_MERGE_OPTIONS,
  type MergeWriteup,
} from "../../config/brandMerge.js";
import {
  readFacts,
  sessionOutcome,
  startSession,
  stoppedReason,
} from "./reviewAgent.js";

/**
 * A brand merge writeup, written by the eve audit agent: two brand kits,
 * the merge options Dallas names, and back a comparison of the two brands
 * and a writeup of each option (config/brandMerge.ts).
 *
 * Started and polled like a capture (reviewAgent.ts). The kits go in the
 * message as text — palette, type, voice, notes, websites — and the agent
 * browses the websites itself for how each brand writes and positions
 * itself. Its instructions for this are agents/audit/agent/instructions/
 * 20-brand-merge.md.
 */

const MAX_REFERENCES_SENT = 12;
const MAX_REFERENCE_CHARS = 600;

export interface MergeKit {
  doc: BrandKitDoc;
  name: string;
}

const LIST = { items: { type: "string" }, type: "array" } as const;

const BRAND_SCHEMA = {
  additionalProperties: false,
  properties: {
    audience: {
      description: "Who it is for, in one line.",
      type: "string",
    },
    name: { type: "string" },
    summary: {
      description:
        "What the brand is and how it presents itself: 2-3 sentences.",
      type: "string",
    },
    voice: { description: "How it sounds, in one line.", type: "string" },
  },
  required: ["audience", "name", "summary", "voice"],
  type: "object",
};

export const MERGE_SCHEMA = {
  additionalProperties: false,
  properties: {
    brands: {
      description: "The two brands, in the order given.",
      items: BRAND_SCHEMA,
      type: "array",
    },
    comparison: {
      description:
        "Side by side, 6-10 rows: positioning, audience, voice, naming, logo, colour, type, imagery, and anything else that matters for this pair.",
      items: {
        additionalProperties: false,
        properties: {
          a: { description: "The first brand, one line.", type: "string" },
          aspect: { type: "string" },
          b: { description: "The second brand, one line.", type: "string" },
          takeaway: {
            description: "What the difference means for a merge, one line.",
            type: "string",
          },
        },
        required: ["a", "aspect", "b", "takeaway"],
        type: "object",
      },
      type: "array",
    },
    options: {
      description:
        "One entry per option named in the request, in that order, with the name exactly as given.",
      items: {
        additionalProperties: false,
        properties: {
          changes: { ...LIST, description: "What changes, 2-5 short items." },
          how: {
            description:
              "How the merged brand would work: name, mark, colour, type, voice and how the two sit together. One paragraph.",
            type: "string",
          },
          keeps: {
            ...LIST,
            description: "What carries over from each brand, 2-5 short items.",
          },
          name: { type: "string" },
          risks: { ...LIST, description: "What could go wrong, 2-4 items." },
          summary: {
            description: "The option in 1-2 sentences.",
            type: "string",
          },
          when: {
            description: "When this is the right choice, in one line.",
            type: "string",
          },
        },
        required: [
          "changes",
          "how",
          "keeps",
          "name",
          "risks",
          "summary",
          "when",
        ],
        type: "object",
      },
      type: "array",
    },
    outcome: {
      description: "One line: the headline of the whole writeup.",
      type: "string",
    },
    overview: {
      description:
        "Two short paragraphs: the two brands, why they are coming together, and what the choice turns on.",
      type: "string",
    },
    recommendation: {
      additionalProperties: false,
      properties: {
        option: {
          description: "The name of the option you'd choose, exactly as given.",
          type: "string",
        },
        why: { description: "Why, in 2-4 sentences.", type: "string" },
      },
      required: ["option", "why"],
      type: "object",
    },
    title: {
      description: 'The writeup\'s title, usually "A + B".',
      type: "string",
    },
  },
  required: [
    "brands",
    "comparison",
    "options",
    "outcome",
    "overview",
    "recommendation",
    "title",
  ],
  type: "object",
};

/** A kit as the agent reads it: what it states, in plain lines. */
export const kitBrief = ({ doc, name }: MergeKit): string => {
  const lines = [`Name: ${name}`];
  if (doc.websites.length > 0) {
    lines.push(`Websites: ${doc.websites.join(", ")}`);
  }
  if (doc.voice.trim()) {
    lines.push(`Voice: ${doc.voice.trim()}`);
  }
  if (doc.palette.length > 0) {
    lines.push(
      `Palette: ${doc.palette
        .map((p) => [p.name, p.role, p.value].filter(Boolean).join(" · "))
        .join("; ")}`
    );
  }
  if (doc.typefaces.length > 0) {
    lines.push(
      `Typefaces: ${doc.typefaces
        .map((t) => [t.name, t.role].filter(Boolean).join(" for "))
        .join("; ")}`
    );
  }
  if (doc.logos.length > 0) {
    lines.push(`Logos: ${doc.logos.map((l) => l.label).join("; ")}`);
  }
  const notes = doc.references.slice(0, MAX_REFERENCES_SENT);
  if (notes.length > 0) {
    lines.push(
      "Notes on file (decisions, feedback, call notes):",
      ...notes.map(
        (r) =>
          `- ${[r.date, r.title].filter(Boolean).join(" ")}: ${r.body.slice(0, MAX_REFERENCE_CHARS)}`
      )
    );
  }
  return lines.join("\n");
};

export const mergeMessage = (
  a: MergeKit,
  b: MergeKit,
  options: string[]
): string =>
  [
    "Write a brand merge writeup, following the Brand merge writeups part of your instructions.",
    "",
    "Brand A",
    kitBrief(a),
    "",
    "Brand B",
    kitBrief(b),
    "",
    "Options to present, in this order (keep each name exactly as written):",
    ...options.map((option, i) => `${i + 1}. ${option}`),
    "",
    "Visit each brand's websites first to read how it positions itself and writes, then compare, then write each option and recommend one.",
  ].join("\n");

export const startMerge = (
  a: MergeKit,
  b: MergeKit,
  options: string[]
): Promise<string> =>
  startSession({
    message: mergeMessage(a, b, options.slice(0, MAX_MERGE_OPTIONS)),
    outputSchema: MERGE_SCHEMA,
  });

/** The writeup's text, from the agent's answer; pictures are added in the editor. */
export type MergeText = MergeWriteup;

export type MergeState =
  | { phase: string; state: "running" }
  | { error: string; state: "failed" }
  | { state: "done"; writeup: MergeText };

/** The agent's answer as writeup text, with the option names as asked. */
export const mergeText = (result: unknown, options: string[]): MergeText => {
  const value = (result ?? {}) as Record<string, unknown>;
  const written = Array.isArray(value.options) ? value.options : [];
  const nameOf = (o: unknown) =>
    typeof o === "object" && o !== null
      ? (o as { name?: unknown }).name
      : undefined;
  // Each asked name takes the option written under it; a name the agent
  // reworded takes the first written option nobody else claimed.
  const byName = options.map((name) => written.find((o) => nameOf(o) === name));
  const spare = written.filter((o) => !byName.includes(o));
  const clean = cleanBrandMerge({
    ...value,
    generatedAt: new Date().toISOString(),
    options: options.map((name, i) => ({
      ...((byName[i] ?? spare.shift() ?? {}) as object),
      image: null,
      name,
    })),
  }) as BrandMerge;
  const {
    boardId: _board,
    brandA: _a,
    brandB: _b,
    hero: _h,
    logoA: _la,
    logoB: _lb,
    ...text
  } = clean;
  return text;
};

export const readMerge = async (
  sessionId: string,
  options: string[]
): Promise<MergeState> => {
  const facts = await readFacts(sessionId);
  const at = sessionOutcome(facts, "Reading the two brands…");
  if (at.state !== "settled") {
    return at;
  }
  if (at.outcome !== "completed") {
    return { error: stoppedReason(at.facts, at.outcome), state: "failed" };
  }
  return { state: "done", writeup: mergeText(at.result, options) };
};
