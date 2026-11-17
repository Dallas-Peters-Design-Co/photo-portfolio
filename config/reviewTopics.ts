/**
 * The deep audit's topic passes: one call each, across every screen, held to
 * the review's brief (api/_lib/uxAudit/topicPasses.ts). Each comes back as
 * its own section of the review, its points split into must-fix and
 * recommended, with the screens each is seen on.
 */

export const AUDIT_TOPICS = [
  { key: "colour", title: "Colour" },
  { key: "type", title: "Typography" },
  { key: "hierarchy", title: "Visual hierarchy and layout" },
  { key: "usability", title: "Usability and key flows" },
  { key: "interactions", title: "Interactions and states" },
  { key: "accessibility", title: "Accessibility and colour blindness" },
  { key: "rules", title: "Rules for developers" },
] as const;

export type AuditTopicKey = (typeof AUDIT_TOPICS)[number]["key"];

export const isAuditTopicKey = (value: unknown): value is AuditTopicKey =>
  AUDIT_TOPICS.some((t) => t.key === value);

export type TopicPriority = "must-fix" | "recommended" | "rule";

export interface TopicPoint {
  detail: string;
  priority: TopicPriority;
  /** The screens it is seen on, by title. */
  screens: string[];
  title: string;
}

export interface AuditTopic {
  points: TopicPoint[];
  /** One or two sentences: how the app does on this topic. */
  summary: string;
  title: string;
}

const PRIORITIES: TopicPriority[] = ["must-fix", "recommended", "rule"];
const MAX_POINTS = 30;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** One topic pass's reply, bounded; null when it holds nothing. */
export const cleanAuditTopic = (
  value: unknown,
  title: string
): AuditTopic | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const points = (Array.isArray(raw.points) ? raw.points : [])
    .slice(0, MAX_POINTS)
    .map((item: unknown) => (item ?? {}) as Record<string, unknown>)
    .map((p) => ({
      detail: str(p.detail, 2000),
      priority: PRIORITIES.includes(p.priority as TopicPriority)
        ? (p.priority as TopicPriority)
        : "recommended",
      screens: (Array.isArray(p.screens) ? p.screens : [])
        .map((s) => str(s, 160))
        .filter(Boolean)
        .slice(0, 12),
      title: str(p.title, 200),
    }))
    .filter((p) => p.title || p.detail);
  const summary = str(raw.summary, 1200);
  return points.length > 0 || summary ? { points, summary, title } : null;
};
