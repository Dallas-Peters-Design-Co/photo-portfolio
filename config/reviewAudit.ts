/**
 * A UX audit, and how it becomes part of a review.
 *
 * The audit is the analysis dallasbpeters/ux-audit-app produces — a summary,
 * strengths, principles, recommendations and findings — with one addition:
 * each finding is placed on a screen, so it arrives as a numbered pin on the
 * screenshot rather than a paragraph somebody has to match up by eye.
 *
 * Shared by the endpoint, which cleans what the model returns, and the
 * editor, which folds it into the draft. Folding only ever adds: an audit run
 * on a review with writing in it appends to that writing and never replaces it.
 */
import { type EditorDoc, isEditorDoc, newItemId } from "./proposal.js";
import {
  PIN_KINDS,
  type PinKind,
  type ReviewDoc,
  type ReviewPin,
  type ReviewSection,
  type RichText,
} from "./review.js";

export type PrincipleStatus = "pass" | "opportunity" | "attention";
const PRINCIPLE_STATUSES: PrincipleStatus[] = [
  "pass",
  "opportunity",
  "attention",
];

const PRINCIPLE_LABELS: Record<PrincipleStatus, string> = {
  attention: "Needs attention",
  opportunity: "Opportunity",
  pass: "Working",
};

export interface AuditPoint {
  detail: string;
  title: string;
}

export interface AuditPrinciple {
  detail: string;
  name: string;
  status: PrincipleStatus;
}

export interface AuditFinding {
  /** Navigation, Visual, Accessibility and so on. */
  area: string;
  detail: string;
  headline: string;
  kind: PinKind;
  /** The screen the pin goes on; null when nothing on a screenshot shows it. */
  screenId: string | null;
  /** Fractions of that screen's picture, like every other pin. */
  x: number;
  y: number;
}

export interface UxAudit {
  execSummary: string;
  findings: AuditFinding[];
  nowFraming: string;
  principles: AuditPrinciple[];
  recommendations: AuditPoint[];
  strengths: AuditPoint[];
}

const MAX_TEXT = 2000;
const MAX_ITEMS = 24;

const str = (v: unknown, max = MAX_TEXT): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const fraction = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(1, Math.max(0, v))
    : 0.5;

const list = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : [])
    .slice(0, MAX_ITEMS)
    .filter(
      (x): x is Record<string, unknown> => typeof x === "object" && x !== null
    );

const cleanPoint = (raw: Record<string, unknown>): AuditPoint => ({
  detail: str(raw.detail),
  title: str(raw.title, 160),
});

/**
 * What the model returned, bounded and typed.
 *
 * `screenIds` is the set the request offered: a finding placed on any other
 * screen is kept but left unplaced, so a hallucinated id can never put a pin
 * on a screen that is not in the review.
 */
export const sanitizeUxAudit = (
  value: unknown,
  screenIds: string[]
): UxAudit => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    execSummary: str(raw.execSummary),
    findings: list(raw.findings)
      .map((f) => {
        const screenId = str(f.screenId, 64);
        return {
          area: str(f.area, 60),
          detail: str(f.detail),
          headline: str(f.headline, 160),
          kind: PIN_KINDS.includes(f.kind as PinKind)
            ? (f.kind as PinKind)
            : "issue",
          screenId: screenIds.includes(screenId) ? screenId : null,
          x: fraction(f.x),
          y: fraction(f.y),
        };
      })
      .filter((f) => f.headline || f.detail),
    nowFraming: str(raw.nowFraming),
    principles: list(raw.principles)
      .map((p) => ({
        detail: str(p.detail),
        name: str(p.name, 160),
        status: PRINCIPLE_STATUSES.includes(p.status as PrincipleStatus)
          ? (p.status as PrincipleStatus)
          : "opportunity",
      }))
      .filter((p) => p.name),
    recommendations: list(raw.recommendations)
      .map(cleanPoint)
      .filter((p) => p.title || p.detail),
    strengths: list(raw.strengths)
      .map(cleanPoint)
      .filter((p) => p.title || p.detail),
  };
};

// ─── Building rich text ─────────────────────────────────────────────────────

type Node = Record<string, unknown>;

const text = (value: string, bold = false): Node =>
  bold
    ? { marks: [{ type: "bold" }], text: value, type: "text" }
    : { text: value, type: "text" };

const paragraph = (...parts: Node[]): Node =>
  parts.length > 0
    ? { content: parts, type: "paragraph" }
    : { type: "paragraph" };

/** "Title. Detail" with the title bold, as one list item. */
const labelled = (title: string, detail: string): Node => {
  const parts: Node[] = [];
  if (title) {
    parts.push(text(detail ? `${title}. ` : title, true));
  }
  if (detail) {
    parts.push(text(detail));
  }
  return { content: [paragraph(...parts)], type: "listItem" };
};

const bulletList = (items: Node[]): Node => ({
  content: items,
  type: "bulletList",
});

const doc = (content: Node[]): EditorDoc => ({ content, type: "doc" });

const BLANK_LINE = /\n\s*\n/;

/** Plain text or a document, as the nodes of a document. */
const nodesOf = (value: RichText): unknown[] => {
  if (isEditorDoc(value)) {
    return value.content;
  }
  return value.trim()
    ? value
        .split(BLANK_LINE)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => paragraph(text(t)))
    : [];
};

/** `addition` after whatever `existing` holds, as one document. */
export const appendRich = (
  existing: RichText,
  addition: EditorDoc
): RichText => {
  const before = nodesOf(existing);
  return before.length === 0
    ? addition
    : doc([...(before as Node[]), ...(addition.content as Node[])]);
};

// ─── Folding an audit into a review ─────────────────────────────────────────

const section = (title: string, content: Node[]): ReviewSection => ({
  body: doc(content),
  id: newItemId(),
  title,
});

const findingPin = (f: AuditFinding): ReviewPin => ({
  body: f.detail,
  id: newItemId(),
  kind: f.kind,
  title: f.headline,
  x: f.x,
  y: f.y,
});

/** The headline findings: the summary, then the thread that ties them. */
const summaryOf = (audit: UxAudit): EditorDoc =>
  doc(
    [audit.execSummary, audit.nowFraming]
      .filter(Boolean)
      .map((t) => paragraph(text(t)))
  );

const sectionsOf = (audit: UxAudit): ReviewSection[] => {
  const out: ReviewSection[] = [];
  if (audit.strengths.length > 0) {
    out.push(
      section("Strengths", [
        bulletList(audit.strengths.map((s) => labelled(s.title, s.detail))),
      ])
    );
  }
  if (audit.principles.length > 0) {
    // Grouped by status, worst first, so the list reads as a to-do.
    const order: PrincipleStatus[] = ["attention", "opportunity", "pass"];
    out.push(
      section(
        "Principles",
        order.flatMap((status) => {
          const items = audit.principles.filter((p) => p.status === status);
          return items.length === 0
            ? []
            : [
                paragraph(text(PRINCIPLE_LABELS[status], true)),
                bulletList(items.map((p) => labelled(p.name, p.detail))),
              ];
        })
      )
    );
  }
  if (audit.recommendations.length > 0) {
    out.push(
      section("Recommendations", [
        bulletList(
          audit.recommendations.map((r) => labelled(r.title, r.detail))
        ),
      ])
    );
  }
  // A finding no screenshot shows still has to be read somewhere.
  const unplaced = audit.findings.filter((f) => f.screenId === null);
  if (unplaced.length > 0) {
    out.push(
      section("Further findings", [
        bulletList(
          unplaced.map((f) =>
            labelled(
              f.area ? `${f.headline} (${f.area})` : f.headline,
              f.detail
            )
          )
        ),
      ])
    );
  }
  return out;
};

/**
 * The review with the audit added: summary appended to the headline
 * findings, a section per list, and each placed finding as a pin on its
 * screen. Nothing already in the review is changed or removed.
 */
export const mergeAudit = (review: ReviewDoc, audit: UxAudit): ReviewDoc => {
  const summary = summaryOf(audit);
  return {
    ...review,
    screens: review.screens.map((screen) => {
      const pins = audit.findings
        .filter((f) => f.screenId === screen.id)
        .map(findingPin);
      return pins.length === 0
        ? screen
        : { ...screen, pins: [...screen.pins, ...pins] };
    }),
    sections: [...review.sections, ...sectionsOf(audit)],
    summary:
      summary.content.length === 0
        ? review.summary
        : appendRich(review.summary, summary),
  };
};
