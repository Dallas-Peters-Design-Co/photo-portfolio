import type { MergeWriteup } from "../../config/brandMerge.js";
import type {
  ReviewDoc,
  ReviewImage,
  ReviewPin,
  ReviewScreen,
  ReviewStatus,
} from "../../config/review.js";
import type { UxAudit } from "../../config/reviewAudit.js";
import type { BriefCoverage } from "../../config/reviewBrief.js";
import type { ReferenceCheck } from "../../config/reviewChecks.js";
import type { ReviewFeedback } from "../../config/reviewFeedback.js";
import type { AuditTopic, AuditTopicKey } from "../../config/reviewTopics.js";
import { apiBase, jsonHeaders, readPageError } from "./portfolioService";
import type { ProposalBrand, ProposalSent } from "./proposalService";
import { keepPass, passHeaders } from "./reviewPass";

/** The reviews client, beside proposalService for the same reason it exists. */

export interface ReviewSummary {
  /** The board it is synced with, if any (ReviewDoc.boardId). */
  boardId: string | null;
  brand: ProposalBrand | null;
  brandKitId: string | null;
  clientEmail: string | null;
  clientName: string;
  counts: { notes: number; screens: number };
  createdAt: string;
  id: string;
  sent: ProposalSent | null;
  slug: string;
  status: ReviewStatus;
  title: string;
  updatedAt: string;
}

// The board link travels in the doc (doc.boardId) on a full record.
export type ReviewRecord = Omit<ReviewSummary, "boardId" | "counts"> & {
  doc: ReviewDoc;
  /** What the client has said on the review page. */
  feedback: ReviewFeedback[];
  /** Whether a password guards it; the password itself never comes back. */
  hasPassword: boolean;
};

/** A review behind a password this browser doesn't hold the pass for. */
export class ReviewLockedError extends Error {
  readonly title: string;
  constructor(title: string) {
    super("This review needs its password");
    this.title = title;
  }
}

/** What a client sends with a comment. */
export type FeedbackInput = Pick<
  ReviewFeedback,
  "author" | "body" | "marks" | "screenId" | "x" | "y"
>;

export type ReviewInput = Partial<
  Pick<
    ReviewRecord,
    | "title"
    | "slug"
    | "clientName"
    | "clientEmail"
    | "brandKitId"
    | "status"
    | "doc"
  >
> & {
  /** A new password; "" or null takes it off; left out, it stays as it is. */
  password?: string | null;
};

const reviewsPath = (): string => `${apiBase()}/api/reviews`;

const json = async <T>(res: Response, fallback: string): Promise<T> => {
  if (!res.ok) {
    throw new Error(await readPageError(res, fallback));
  }
  return (await res.json()) as T;
};

export const reviewsApi = {
  /** Runs a UX audit across the review's captured screens through Claude. */
  audit: async (input: {
    brief?: string;
    screens: ReviewScreen[];
    title?: string;
  }): Promise<{ audit: UxAudit }> =>
    json(
      await fetch(`${reviewsPath()}/audit`, {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not run the UX audit"
    ),

  /** What the brief asks for, and whether the screens show it. */
  auditCoverage: async (input: {
    brief: string;
    screens: ReviewScreen[];
    title?: string;
  }): Promise<{ coverage: BriefCoverage[] }> =>
    json(
      await fetch(`${reviewsPath()}/audit`, {
        body: JSON.stringify({ ...input, part: "coverage" }),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not check the brief's coverage"
    ),

  /** One topic of the deep audit (config/reviewTopics.ts), across the screens. */
  auditTopic: async (input: {
    brief?: string;
    screens: ReviewScreen[];
    title?: string;
    topic: AuditTopicKey;
  }): Promise<{ topic: AuditTopic | null }> =>
    json(
      await fetch(`${reviewsPath()}/audit`, {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not run that part of the audit"
    ),

  /** Screenshots a URL for a screen. Admin only; slow (a real browser). */
  capture: async (input: {
    slug: string;
    url: string;
    viewport: "desktop" | "mobile";
  }): Promise<{ image: ReviewImage; viewport: "desktop" | "mobile" }> =>
    json(
      await fetch(`${reviewsPath()}/capture`, {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not capture that page"
    ),

  /** Where an agent capture stands; when done, its screens are stored. */
  captureStatus: async (
    session: string,
    slug: string
  ): Promise<
    | { state: "running"; phase: string }
    | {
        checks: ReferenceCheck[];
        note: string;
        screens: ReviewScreen[];
        state: "done";
      }
    | { state: "failed"; error: string }
  > =>
    json(
      await fetch(
        `${reviewsPath()}/explore?session=${encodeURIComponent(session)}&slug=${encodeURIComponent(slug)}`,
        { headers: jsonHeaders() }
      ),
      "Could not check the capture"
    ),

  /** Starts an agent capture of an app behind a login. Returns its session. */
  captureWithLogin: async (input: {
    brief?: string;
    loginUrl?: string;
    pages?: number;
    slug: string;
    url: string;
  }): Promise<{ session: string }> =>
    json(
      await fetch(`${reviewsPath()}/explore`, {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not start the capture"
    ),

  /** Adds a client's comment (and their markup) to a published review. */
  comment: async (
    slug: string,
    input: FeedbackInput
  ): Promise<ReviewFeedback> =>
    json(
      await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}/feedback`, {
        body: JSON.stringify(input),
        headers: {
          ...(jsonHeaders() as Record<string, string>),
          ...passHeaders(slug),
        },
        method: "POST",
      }),
      "Couldn't post that comment"
    ),

  create: async (
    input: ReviewInput & { title: string; slug: string }
  ): Promise<ReviewRecord> =>
    json(
      await fetch(reviewsPath(), {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not create review"
    ),

  get: async (slug: string): Promise<ReviewRecord> => {
    const res = await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}`, {
      headers: {
        ...(jsonHeaders() as Record<string, string>),
        ...passHeaders(slug),
      },
    });
    if (res.status === 401) {
      const body = (await res.json().catch(() => ({}))) as {
        locked?: boolean;
        title?: string;
      };
      if (body.locked) {
        keepPass(slug, null);
        throw new ReviewLockedError(body.title ?? "");
      }
    }
    return json(res, "Could not load review");
  },

  list: async (): Promise<ReviewSummary[]> =>
    json(
      await fetch(reviewsPath(), { headers: jsonHeaders() }),
      "Could not load reviews"
    ),

  /** Starts the agent on a brand merge writeup. Returns its session. */
  mergeStart: async (input: {
    brandA: string;
    brandB: string;
    options: string[];
  }): Promise<{ session: string }> =>
    json(
      await fetch(`${reviewsPath()}/explore`, {
        body: JSON.stringify({ ...input, kind: "merge" }),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not start the writeup"
    ),

  /** Where an agent's brand merge writeup stands; when done, its text. */
  mergeStatus: async (
    session: string,
    options: string[]
  ): Promise<
    | { state: "running"; phase: string }
    | { state: "done"; writeup: MergeWriteup }
    | { state: "failed"; error: string }
  > =>
    json(
      await fetch(
        `${reviewsPath()}/explore?kind=merge&session=${encodeURIComponent(session)}&options=${encodeURIComponent(JSON.stringify(options))}`,
        { headers: jsonHeaders() }
      ),
      "Could not check the writeup"
    ),

  remove: async (slug: string): Promise<void> => {
    const res = await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}`, {
      headers: jsonHeaders(),
      method: "DELETE",
    });
    if (res.status === 204 || res.status === 404) {
      return;
    }
    throw new Error(await readPageError(res, "Could not delete review"));
  },

  /** Removes a client's comment. Designer only. */
  removeComment: async (slug: string, id: string): Promise<void> => {
    const res = await fetch(
      `${reviewsPath()}/${encodeURIComponent(slug)}/feedback?id=${encodeURIComponent(id)}`,
      { headers: jsonHeaders(), method: "DELETE" }
    );
    if (!res.ok) {
      throw new Error(await readPageError(res, "Couldn't remove that comment"));
    }
  },

  /** Marks a client's comment dealt with, or not. Designer only. */
  resolveComment: async (slug: string, id: string, resolved: boolean) =>
    json<ReviewFeedback>(
      await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}/feedback`, {
        body: JSON.stringify({ id, resolved }),
        headers: jsonHeaders(),
        method: "PATCH",
      }),
      "Couldn't update that comment"
    ),

  /**
   * Scans a captured page for WCAG failures; returns Accessibility notes
   * placed on the failing elements. Slow, like a capture.
   */
  scanAccessibility: async (input: {
    height: number;
    url: string;
    viewport: "desktop" | "mobile";
  }): Promise<{ pins: ReviewPin[] }> =>
    json(
      await fetch(`${reviewsPath()}/capture`, {
        body: JSON.stringify({ ...input, scan: "accessibility" }),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not scan that page"
    ),

  send: async (
    slug: string,
    input: { note?: string } = {}
  ): Promise<ReviewRecord> =>
    json(
      await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}/send`, {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "Could not send review"
    ),

  /** Trades the password for a pass, kept in this browser. */
  unlock: async (slug: string, password: string): Promise<void> => {
    const { pass } = await json<{ pass: string | null }>(
      await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}`, {
        body: JSON.stringify({ password }),
        headers: jsonHeaders(),
        method: "POST",
      }),
      "That isn't the password"
    );
    keepPass(slug, pass);
  },

  update: async (slug: string, input: ReviewInput): Promise<ReviewRecord> =>
    json(
      await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}`, {
        body: JSON.stringify(input),
        headers: jsonHeaders(),
        method: "PATCH",
      }),
      "Could not save review"
    ),
};
