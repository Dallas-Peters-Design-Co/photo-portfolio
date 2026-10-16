/**
 * Shared shapes for reviews. Same conventions as proposals.ts: the row as
 * the database returns it, the DTO the admin and the public page read, and
 * the one SELECT every read uses so list and lookup cannot drift.
 */
import {
  type ReviewDoc,
  type ReviewStatus,
  sanitizeReviewDoc,
} from "../../config/review.js";
import {
  type ProposalBrand,
  type ProposalSent,
  pickAccent,
} from "./proposals.js";

export interface ReviewRow {
  brand_kit_id: string | null;
  client_email?: string | null;
  client_name: string;
  created_at: string | Date;
  doc: unknown;
  id: string;
  kit_name?: string | null;
  kit_palette?: unknown;
  sent_at?: string | Date | null;
  sent_to?: string | null;
  slug: string;
  status: ReviewStatus;
  title: string;
  updated_at: string | Date;
}

export interface ReviewDto {
  brand: ProposalBrand | null;
  brandKitId: string | null;
  clientEmail: string | null;
  clientName: string;
  createdAt: string;
  doc: ReviewDoc;
  id: string;
  sent: ProposalSent | null;
  slug: string;
  status: ReviewStatus;
  title: string;
  updatedAt: string;
}

export type ReviewSummaryDto = Omit<ReviewDto, "doc"> & {
  /** How many screens and notes it holds, for the list. */
  counts: { notes: number; screens: number };
};

const toIso = (value: string | Date): string => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? new Date(0).toISOString()
    : d.toISOString();
};

export const isReviewStatus = (value: unknown): value is ReviewStatus =>
  value === "draft" || value === "published";

export const rowToReviewDto = (row: ReviewRow): ReviewDto => ({
  brand: row.kit_name
    ? { accent: pickAccent(row.kit_palette), name: row.kit_name }
    : null,
  brandKitId: row.brand_kit_id,
  clientEmail: row.client_email ?? null,
  clientName: row.client_name,
  createdAt: toIso(row.created_at),
  doc: sanitizeReviewDoc(row.doc),
  id: row.id,
  sent:
    row.sent_at && row.sent_to
      ? { at: toIso(row.sent_at), to: row.sent_to }
      : null,
  slug: row.slug,
  status: row.status,
  title: row.title,
  updatedAt: toIso(row.updated_at),
});

export const rowToReviewSummary = (row: ReviewRow): ReviewSummaryDto => {
  const { doc, ...rest } = rowToReviewDto(row);
  return {
    ...rest,
    counts: {
      notes: doc.screens.reduce((n, s) => n + s.pins.length, 0),
      screens: doc.screens.length,
    },
  };
};

export const REVIEW_SELECT = `
  r.id, r.slug, r.title, r.client_name, r.client_email, r.brand_kit_id, r.doc, r.status,
  r.sent_at, r.sent_to, r.created_at, r.updated_at,
  bk.name AS kit_name,
  v.doc -> 'palette' AS kit_palette
  FROM reviews r
  LEFT JOIN brand_kits bk ON bk.id = r.brand_kit_id
  LEFT JOIN brand_kit_versions v ON v.id = bk.current_version_id
`;
