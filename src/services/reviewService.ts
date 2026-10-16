import type {
  ReviewDoc,
  ReviewImage,
  ReviewStatus,
} from "../../config/review.js";
import { apiBase, jsonHeaders, readPageError } from "./portfolioService";
import type { ProposalBrand, ProposalSent } from "./proposalService";

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

export type ReviewRecord = Omit<ReviewSummary, "counts"> & { doc: ReviewDoc };

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
>;

const reviewsPath = (): string => `${apiBase()}/api/reviews`;

const json = async <T>(res: Response, fallback: string): Promise<T> => {
  if (!res.ok) {
    throw new Error(await readPageError(res, fallback));
  }
  return (await res.json()) as T;
};

export const reviewsApi = {
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

  get: async (slug: string): Promise<ReviewRecord> =>
    json(
      await fetch(`${reviewsPath()}/${encodeURIComponent(slug)}`, {
        headers: jsonHeaders(),
      }),
      "Could not load review"
    ),

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
