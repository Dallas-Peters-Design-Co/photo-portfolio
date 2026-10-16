/**
 * The shape of a proposal, shared by the API that stores it and the pages that
 * edit and render it.
 *
 * A proposal is one document: a short opening, a set of prose sections (how I
 * work, what to expect, the approach), the packages with their prices, the
 * add-ons, and the terms. Everything is plain text rather than editor JSON —
 * a proposal is written once and read once, and the few things the text needs
 * (paragraphs, a bulleted list) are carried by `textToBlocks` below.
 *
 * `sanitizeProposalDoc` is the single place the server decides what a document
 * may contain. It never throws: an unknown field is dropped, an over-long one
 * is cut, and a missing one takes the default, so a half-filled form saves
 * rather than 400s.
 */

export type ProposalStatus = "draft" | "published";

/**
 * Rich text, as the CMS editor stores it: a TipTap document. A plain string is
 * also accepted, so a proposal written before the editor arrived (or seeded
 * from a script) still renders; `textToBlocks` below handles that case.
 */
export interface EditorDoc {
  content: unknown[];
  type: "doc";
}
export type RichText = EditorDoc | string;

export const isEditorDoc = (value: unknown): value is EditorDoc =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "doc" &&
  Array.isArray((value as { content?: unknown }).content);

/** True when there is nothing to show: an empty string or a doc with no text. */
export const isRichTextEmpty = (value: RichText): boolean => {
  if (typeof value === "string") {
    return value.trim() === "";
  }
  const hasText = (node: unknown): boolean => {
    if (typeof node !== "object" || node === null) {
      return false;
    }
    const n = node as { text?: unknown; type?: unknown; content?: unknown };
    if (typeof n.text === "string" && n.text.trim()) {
      return true;
    }
    if (n.type === "image" || n.type === "video") {
      return true;
    }
    return Array.isArray(n.content) && n.content.some(hasText);
  };
  return !value.content.some(hasText);
};

export interface ProposalSection {
  body: RichText;
  heading: string;
  id: string;
}

export interface ProposalPackage {
  /** Who this option is for, in a sentence. */
  bestFor: string;
  id: string;
  /** One line per deliverable. */
  includes: string[];
  name: string;
  /** How it is paid: "50% to start, 50% at delivery". */
  payment: string;
  /** Display string, so "$2,500" and "$5,000 / month" both work. */
  price: string;
  /** A qualifier under the price: "fixed", "3-month minimum". */
  priceNote: string;
  /** Marks the option the proposal leads with. */
  recommended: boolean;
  revisions: string;
  timeline: string;
}

export interface ProposalAddOn {
  id: string;
  name: string;
  price: string;
}

export interface ProposalStep {
  body: string;
  id: string;
  title: string;
}

export interface ProposalDoc {
  addOns: ProposalAddOn[];
  /** The closing line above the signatures. */
  closing: RichText;
  /** The opening paragraph under the title, addressed to the client. */
  intro: RichText;
  packages: ProposalPackage[];
  /** What happens after yes, step by step. */
  process: ProposalStep[];
  sections: ProposalSection[];
  /** A short restatement of what the client asked for. */
  summary: RichText;
  terms: string[];
  /** ISO date, or empty when the offer does not expire. */
  validUntil: string;
}

export const MAX_PROPOSAL_TITLE = 120;
export const MAX_CLIENT_NAME = 120;
const MAX_SHORT = 200;
const MAX_LINE = 400;
const MAX_BODY = 6000;
const MAX_LIST = 40;
const MAX_ID = 40;
/** An editor document, serialised. Generous: images are URLs, not payloads. */
const MAX_DOC_BYTES = 200_000;

/**
 * A stable id for a list item, so the editor can key rows while they are being
 * reordered and renamed. Short and unguessable enough for that; it is never a
 * secret.
 */
export const newItemId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * What every new proposal starts with.
 *
 * The sections are written to be true of any engagement, so they survive a
 * client being swapped in; the packages are left for the proposal itself,
 * since a price belongs to a scope and not to a template.
 */
export const DEFAULT_PROPOSAL_DOC: ProposalDoc = {
  addOns: [],
  closing:
    "If any of this is off, tell me and I'll adjust it. The fastest way to start is to reply with the option you want and I'll send the agreement and first invoice the same day.",
  intro:
    "Thanks for the conversation. This is what I heard, what I'd suggest, and what it costs. It's written so you can forward it to anyone else who needs to weigh in.",
  packages: [],
  process: [
    {
      body: "You pick an option and I send a short agreement and the first invoice. Work starts once both are back.",
      id: "step-agree",
      title: "Agree",
    },
    {
      body: "A 45-minute kickoff to confirm scope, collect existing assets and access, and agree how we'll communicate. You leave with a dated plan.",
      id: "step-kickoff",
      title: "Kickoff",
    },
    {
      body: "I share work early and often, usually as a link you can open on your phone. Each round has a clear question attached so feedback stays focused.",
      id: "step-rounds",
      title: "Rounds",
    },
    {
      body: "Final files, source files, and a short walkthrough of how to use them. Nothing is locked behind me.",
      id: "step-handoff",
      title: "Handoff",
    },
  ],
  sections: [
    {
      body: "I work in short, visible loops. You'll see rough work before polished work, because the expensive mistakes happen when a design is approved in the abstract and only questioned once it's built.\n\nEvery round comes with one or two specific questions I need answered. That keeps feedback useful and keeps me from guessing.\n\nI'd rather cut scope than cut quality. If something isn't going to be good by the deadline, I'll say so early and we'll decide together what moves.",
      heading: "How I work",
      id: "section-how",
    },
    {
      body: "- A single point of contact on each side, and a shared channel (Slack, email, or whatever you already use) for everything in between calls.\n- One scheduled check-in a week, kept short. Async updates the rest of the time, so a six-hour time difference isn't a problem.\n- Feedback turned around within two working days keeps the timeline. Longer than that and the dates move with it.\n- Everything I make lives in a shared Figma or Framer file you can open at any time, so there's never a version you haven't seen.",
      heading: "What to expect",
      id: "section-expect",
    },
    {
      body: "Design should look like it was made by someone who understood the product and the people using it, not like it came out of a template. That means starting from what your users actually need to trust you, and only then choosing colour, type and layout.\n\nFor products in serious fields the brand has to read as rigorous first and modern second. I'll push back on anything that trades credibility for trend.\n\nI build in the tools your team will keep using afterwards. A design system you can't maintain is a liability, so I hand over tokens, components and a short guide, not just pictures.",
      heading: "Approach to design",
      id: "section-approach",
    },
  ],
  summary: "",
  terms: [
    "Prices are in USD and exclude any third-party costs (fonts, stock, hosting), which are agreed before they're incurred.",
    "Fixed-price options include the revision rounds listed. Further rounds are billed at the add-on rate.",
    "Timelines assume feedback within two working days and start once the first payment has cleared.",
    "You own the final deliverables on full payment. I keep the right to show the work in my portfolio unless we agree otherwise in writing.",
    "Either of us can end the engagement with two weeks' notice. Work completed to that point is invoiced and handed over.",
  ],
  validUntil: "",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanText = (value: unknown, max: number): string =>
  typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim().slice(0, max)
    : "";

const cleanRich = (value: unknown, max: number): RichText => {
  if (isEditorDoc(value)) {
    return JSON.stringify(value).length <= MAX_DOC_BYTES
      ? value
      : { content: [], type: "doc" };
  }
  return cleanText(value, max);
};

const cleanId = (value: unknown): string => {
  const id = cleanText(value, MAX_ID).replace(/[^a-zA-Z0-9_-]/g, "");
  return id || newItemId();
};

const cleanLines = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const lines: string[] = [];
  for (const item of value) {
    const line = cleanText(item, MAX_LINE);
    if (line) {
      lines.push(line);
    }
    if (lines.length >= MAX_LIST) {
      break;
    }
  }
  return lines;
};

const cleanList = <T>(
  value: unknown,
  clean: (item: Record<string, unknown>) => T
): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: T[] = [];
  for (const item of value) {
    if (isRecord(item)) {
      out.push(clean(item));
    }
    if (out.length >= MAX_LIST) {
      break;
    }
  }
  return out;
};

const cleanSection = (item: Record<string, unknown>): ProposalSection => ({
  body: cleanRich(item.body, MAX_BODY),
  heading: cleanText(item.heading, MAX_SHORT),
  id: cleanId(item.id),
});

const cleanPackage = (item: Record<string, unknown>): ProposalPackage => ({
  bestFor: cleanText(item.bestFor, MAX_LINE),
  id: cleanId(item.id),
  includes: cleanLines(item.includes),
  name: cleanText(item.name, MAX_SHORT),
  payment: cleanText(item.payment, MAX_SHORT),
  price: cleanText(item.price, MAX_SHORT),
  priceNote: cleanText(item.priceNote, MAX_SHORT),
  recommended: item.recommended === true,
  revisions: cleanText(item.revisions, MAX_SHORT),
  timeline: cleanText(item.timeline, MAX_SHORT),
});

const cleanAddOn = (item: Record<string, unknown>): ProposalAddOn => ({
  id: cleanId(item.id),
  name: cleanText(item.name, MAX_SHORT),
  price: cleanText(item.price, MAX_SHORT),
});

const cleanStep = (item: Record<string, unknown>): ProposalStep => ({
  body: cleanText(item.body, MAX_BODY),
  id: cleanId(item.id),
  title: cleanText(item.title, MAX_SHORT),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Any input in, a well-formed document out. Never throws. */
export const sanitizeProposalDoc = (value: unknown): ProposalDoc => {
  const raw = isRecord(value) ? value : {};
  const validUntil = cleanText(raw.validUntil, 10);
  return {
    addOns: cleanList(raw.addOns, cleanAddOn),
    closing: cleanRich(raw.closing, MAX_BODY),
    intro: cleanRich(raw.intro, MAX_BODY),
    packages: cleanList(raw.packages, cleanPackage),
    process: cleanList(raw.process, cleanStep),
    sections: cleanList(raw.sections, cleanSection),
    summary: cleanRich(raw.summary, MAX_BODY),
    terms: cleanLines(raw.terms),
    validUntil: ISO_DATE.test(validUntil) ? validUntil : "",
  };
};

export type TextBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/**
 * Plain text into the two things a proposal body needs: paragraphs and
 * bulleted lists. A blank line ends a paragraph; consecutive lines starting
 * with "- " form one list. Nothing else is interpreted, so pasted text renders
 * as it was typed.
 */
export const textToBlocks = (text: string): TextBlock[] => {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ items: list, kind: "list" });
      list = [];
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
};
