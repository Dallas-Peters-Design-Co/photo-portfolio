import { isRichTextEmpty, richTextPlainText } from "./proposal.js";
import { numberPins, type PinKind, type ReviewDoc } from "./review.js";

const COLON_SUFFIX = /:$/;
const TITLE_END = /[.\s]+$/;

export const REVIEW_FIX_PRIORITIES = [
  { key: "must-fix", label: "Must fix" },
  { key: "recommended", label: "Recommended" },
  { key: "later", label: "Consider later" },
] as const;

export const MAX_REVIEW_FIXES = 25;

export type ReviewFixPriority = (typeof REVIEW_FIX_PRIORITIES)[number]["key"];

export interface PrioritizedFix {
  anchor: string;
  context: string;
  id: string;
  label: string;
  priority: ReviewFixPriority;
  title: string;
}

const PRIORITY_BY_KIND: Partial<Record<PinKind, ReviewFixPriority>> = {
  accessibility: "must-fix",
  issue: "must-fix",
  recommendation: "recommended",
  suggestion: "later",
};

interface RichNode {
  content?: unknown[];
  marks?: { type?: unknown }[];
  text?: string;
  type?: string;
}

const nodesOf = (value: unknown): RichNode[] =>
  typeof value === "object" && value !== null && "content" in value
    ? ((value as { content?: unknown[] }).content ?? []).filter(
        (node): node is RichNode => typeof node === "object" && node !== null
      )
    : [];

const textOf = (
  value: unknown,
  bold = false
): { bold: string; text: string } => {
  if (typeof value !== "object" || value === null) {
    return { bold: "", text: "" };
  }
  const node = value as RichNode;
  const isBold =
    bold || node.marks?.some((mark) => mark.type === "bold") === true;
  if (typeof node.text === "string") {
    return { bold: isBold ? node.text : "", text: node.text };
  }
  return nodesOf(node).reduce<{ bold: string; text: string }>(
    (result, child) => {
      const part = textOf(child, isBold);
      return { bold: result.bold + part.bold, text: result.text + part.text };
    },
    { bold: "", text: "" }
  );
};

const priorityHeading = (text: string): ReviewFixPriority | null => {
  const label = text.trim().toLowerCase().replace(COLON_SUFFIX, "");
  if (["must fix", "needs attention"].includes(label)) {
    return "must-fix";
  }
  if (["recommended", "recommendations", "opportunity"].includes(label)) {
    return "recommended";
  }
  if (["rules", "consider later"].includes(label)) {
    return "later";
  }
  return null;
};

/** Recover audit recommendations from older reviews where they were prose lists. */
const auditSectionFixes = (section: ReviewDoc["sections"][number]) => {
  if (!section.fromAudit) {
    return [];
  }
  const sectionTitle = section.title.trim().toLowerCase();
  let priority: ReviewFixPriority | null = null;
  if (sectionTitle === "recommendations") {
    priority = "recommended";
  } else if (sectionTitle === "further findings") {
    priority = "recommended";
  }

  const fixes: PrioritizedFix[] = [];
  const listFixes = (node: RichNode, current: ReviewFixPriority | null) => {
    if (!current) {
      return;
    }
    for (const item of nodesOf(node)) {
      const { bold, text } = textOf(item);
      const title = (bold.trim() || text.trim()).replace(TITLE_END, "");
      if (title) {
        fixes.push({
          anchor: `review-section-${section.id}`,
          context: section.title || "Review section",
          id: `${section.id}-audit-${fixes.length}`,
          label: "Audit item",
          priority: current,
          title,
        });
      }
    }
  };
  const visit = (node: RichNode) => {
    if (node.type === "paragraph") {
      const label = textOf(node).text.trim();
      const heading = priorityHeading(label);
      if (heading !== null || label.toLowerCase() === "working") {
        priority = heading;
      }
      return;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      listFixes(node, priority);
      return;
    }
    for (const child of nodesOf(node)) {
      visit(child);
    }
  };
  for (const node of nodesOf(section.body)) {
    visit(node);
  }
  return fixes;
};

/** Actionable notes and section recommendations, ordered by priority. */
export const prioritizedFixes = (doc: ReviewDoc): PrioritizedFix[] => {
  const pinFixes = numberPins(doc).flatMap(({ n, pin, screen }) => {
    const priority = PRIORITY_BY_KIND[pin.kind];
    const bodyText = richTextPlainText(pin.body).trim();
    const title = pin.title.trim() || bodyText.split("\n")[0]?.trim();
    return priority && title
      ? [
          {
            anchor: `note-${pin.id}`,
            context: screen.title || "Screen",
            id: pin.id,
            label: `Note ${n}`,
            priority,
            title,
          },
        ]
      : [];
  });
  const sectionFixes = doc.sections.flatMap((section) => [
    ...(section.recommendations ?? [])
      .filter(
        (recommendation) =>
          recommendation.title.trim() || !isRichTextEmpty(recommendation.body)
      )
      .map((recommendation) => ({
        anchor: `review-recommendation-${recommendation.id}`,
        context: section.title || "Section",
        id: recommendation.id,
        label: "Recommendation",
        priority: "recommended" as const,
        title:
          recommendation.title.trim() ||
          (typeof recommendation.body === "string"
            ? recommendation.body.trim().split("\n")[0] || "Recommendation"
            : "Recommendation"),
      })),
    ...auditSectionFixes(section),
  ]);
  const seen = new Set<string>();
  const fixes = [...pinFixes, ...sectionFixes].filter((fix) => {
    const key = `${fix.priority}:${fix.context.trim().toLowerCase()}:${fix.title
      .trim()
      .toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return REVIEW_FIX_PRIORITIES.flatMap(({ key }) =>
    fixes.filter((fix) => fix.priority === key)
  ).slice(0, MAX_REVIEW_FIXES);
};
