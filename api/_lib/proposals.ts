/**
 * Shared shapes and validation for proposals.
 *
 * A proposal lives under /proposal/:slug, its own path, so its slug can never
 * shadow the admin the way a CMS page's could. It is still checked against the
 * same pattern as a page's, because a slug is also a URL segment.
 */

import type { PaletteEntry } from "../../config/brandKit.js";
import {
  type ProposalDoc,
  type ProposalStatus,
  sanitizeProposalDoc,
} from "../../config/proposal.js";

export interface ProposalRow {
  accepted_at?: string | Date | null;
  accepted_name?: string | null;
  accepted_option?: string | null;
  accepted_title?: string | null;
  brand_kit_id: string | null;
  client_email?: string | null;
  client_name: string;
  created_at: string | Date;
  doc: unknown;
  id: string;
  /** Joined from the kit's current version; null when there is no kit. */
  kit_name?: string | null;
  kit_palette?: unknown;
  sent_at?: string | Date | null;
  sent_to?: string | null;
  slug: string;
  status: ProposalStatus;
  title: string;
  updated_at: string | Date;
}

export interface ProposalBrand {
  /** The colour the public page uses for its accents, or null to use the site's. */
  accent: string | null;
  name: string;
}

export interface ProposalAcceptance {
  at: string;
  name: string;
  /** The id of the package chosen, when one was. */
  option: string | null;
  title: string | null;
}

/** The last time the link went to the client, and where. */
export interface ProposalSent {
  at: string;
  to: string;
}

export interface ProposalDto {
  acceptance: ProposalAcceptance | null;
  brand: ProposalBrand | null;
  brandKitId: string | null;
  clientEmail: string | null;
  clientName: string;
  createdAt: string;
  doc: ProposalDoc;
  id: string;
  sent: ProposalSent | null;
  slug: string;
  status: ProposalStatus;
  title: string;
  updatedAt: string;
}

/** The admin list: no body, so the payload stays small. */
export type ProposalSummaryDto = Omit<ProposalDto, "doc">;

const toIso = (value: string | Date): string => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? new Date(0).toISOString()
    : d.toISOString();
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The kit's accent, in this order: the entry whose role says "accent", then
 * "primary", then the first entry at all. A kit may not name roles the way
 * this expects, so none of these is required — a kit with no usable colour
 * simply leaves the page on the site's own accent.
 */
export const pickAccent = (palette: unknown): string | null => {
  if (!Array.isArray(palette)) {
    return null;
  }
  const entries = palette.filter(
    (p): p is PaletteEntry =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as PaletteEntry).value === "string"
  );
  const byRole = (role: string) =>
    entries.find((p) =>
      String(p.role ?? "")
        .toLowerCase()
        .includes(role)
    );
  const chosen = byRole("accent") ?? byRole("primary") ?? entries[0];
  const value = chosen?.value.trim() ?? "";
  return HEX.test(value) ? value : null;
};

const rowToBrand = (row: ProposalRow): ProposalBrand | null => {
  if (!row.kit_name) {
    return null;
  }
  return { accent: pickAccent(row.kit_palette), name: row.kit_name };
};

const rowToAcceptance = (row: ProposalRow): ProposalAcceptance | null =>
  row.accepted_at && row.accepted_name
    ? {
        at: toIso(row.accepted_at),
        name: row.accepted_name,
        option: row.accepted_option ?? null,
        title: row.accepted_title ?? null,
      }
    : null;

const rowToSent = (row: ProposalRow): ProposalSent | null =>
  row.sent_at && row.sent_to
    ? { at: toIso(row.sent_at), to: row.sent_to }
    : null;

export const rowToSummary = (row: ProposalRow): ProposalSummaryDto => ({
  acceptance: rowToAcceptance(row),
  brand: rowToBrand(row),
  brandKitId: row.brand_kit_id,
  clientEmail: row.client_email ?? null,
  clientName: row.client_name,
  createdAt: toIso(row.created_at),
  id: row.id,
  sent: rowToSent(row),
  slug: row.slug,
  status: row.status,
  title: row.title,
  updatedAt: toIso(row.updated_at),
});

export const rowToDto = (row: ProposalRow): ProposalDto => ({
  ...rowToSummary(row),
  doc: sanitizeProposalDoc(row.doc),
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SlugCheck =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export const normalizeProposalSlug = (raw: unknown): SlugCheck => {
  const slug = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!slug) {
    return { error: "A proposal address is required.", ok: false };
  }
  if (slug.length > 60) {
    return { error: "Address must be 60 characters or fewer.", ok: false };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      error:
        "Address may use lowercase letters, numbers and single hyphens only.",
      ok: false,
    };
  }
  return { ok: true, slug };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An address, lower-cased, or null for anything that is not one. */
export const cleanEmail = (value: unknown): string | null => {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v && v.length <= 254 && EMAIL.test(v) ? v : null;
};

export const isProposalStatus = (value: unknown): value is ProposalStatus =>
  value === "draft" || value === "published";

/**
 * The columns every proposal read selects, with the kit's name and palette
 * folded in. One string so the list and the point lookup cannot drift.
 */
export const PROPOSAL_SELECT = `
  p.id, p.slug, p.title, p.client_name, p.client_email, p.brand_kit_id, p.doc, p.status,
  p.created_at, p.updated_at,
  p.accepted_at, p.accepted_name, p.accepted_title, p.accepted_option,
  p.sent_at, p.sent_to,
  bk.name AS kit_name,
  v.doc -> 'palette' AS kit_palette
  FROM proposals p
  LEFT JOIN brand_kits bk ON bk.id = p.brand_kit_id
  LEFT JOIN brand_kit_versions v ON v.id = bk.current_version_id
`;
