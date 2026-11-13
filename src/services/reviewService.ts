import type {
  ReviewDoc,
  ReviewImage,
  ReviewScreen,
  ReviewStatus,
} from "../../config/review.js";
import type { UxAudit } from "../../config/reviewAudit.js";
import type { ReviewFeedback } from "../../config/reviewFeedback.js";
import { apiBase, jsonHeaders, readPageError } from "./portfolioService";
import type { ProposalBrand, ProposalSent } from "./proposalService";
import { keepPass, passHeaders } from "./reviewPass";

/** The reviews client, beside proposalService for the same reason it exists. */

export interface ReviewSummary {
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

export type ReviewRecord = Omit<ReviewSummary, "counts"> & {
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
