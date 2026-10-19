/**
 * Invoices against a proposal: the row shape, what the admin sees, and how a
 * signed option becomes its first invoice.
 *
 * Amounts are whole cents throughout. A proposal's prices are free text
 * ("$3,000", "$3,000 / month", "$2,500 fixed"), so the first figure in the
 * text is the price; a price with no figure in it cannot be invoiced
 * automatically and is left to the owner.
 */

import type { ProposalPackage } from "../../config/proposal.js";
import type { getSql } from "./db.js";

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible";

export interface InvoiceRow {
  amount_cents: number;
  created_at: string | Date;
  currency: string;
  customer_email: string;
  customer_name: string;
  description: string;
  due_days: number;
  hosted_url: string | null;
  id: string;
  number: string | null;
  paid_at: string | Date | null;
  pdf_url: string | null;
  proposal_id: string | null;
  sent_at: string | Date | null;
  status: InvoiceStatus;
  stripe_invoice_id: string | null;
}

export interface InvoiceDto {
  amountCents: number;
  createdAt: string;
  currency: string;
  customerEmail: string;
  customerName: string;
  description: string;
  dueDays: number;
  hostedUrl: string | null;
  id: string;
  number: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
  proposalId: string | null;
  sentAt: string | null;
  status: InvoiceStatus;
}

export const INVOICE_COLUMNS = `id, proposal_id, description, amount_cents,
  currency, due_days, status, customer_email, customer_name, stripe_invoice_id,
  number, hosted_url, pdf_url, created_at, sent_at, paid_at`;

const iso = (value: string | Date | null): string | null =>
  value ? new Date(value).toISOString() : null;

export const rowToInvoice = (row: InvoiceRow): InvoiceDto => ({
  amountCents: row.amount_cents,
  createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
  currency: row.currency,
  customerEmail: row.customer_email,
  customerName: row.customer_name,
  description: row.description,
  dueDays: row.due_days,
  hostedUrl: row.hosted_url,
  id: row.id,
  number: row.number,
  paidAt: iso(row.paid_at),
  pdfUrl: row.pdf_url,
  proposalId: row.proposal_id,
  sentAt: iso(row.sent_at),
  status: row.status,
});

const MONEY = /(\d[\d,]*(?:\.\d{1,2})?)/;
const PERCENT = /(\d{1,3})\s*%/;

/** The first figure in a price, in cents: "$3,000 / month" → 300000. */
export const priceToCents = (price: string): number | null => {
  const match = MONEY.exec(price);
  if (!match?.[1]) {
    return null;
  }
  const value = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
};

/**
 * What share is due first, from the payment terms: "50% to start, 50% at
 * delivery" → 50; "100% up front" → 100; anything without a percentage
 * ("Monthly, in advance", "On delivery") → the whole price.
 */
export const firstInstalmentPercent = (payment: string): number => {
  const pct = Number(PERCENT.exec(payment)?.[1]);
  return pct > 0 && pct <= 100 ? pct : 100;
};

export const formatMoney = (cents: number, currency = "usd"): string =>
  new Intl.NumberFormat("en-US", {
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(cents / 100);

export interface InvoiceDraft {
  amountCents: number;
  description: string;
}

/**
 * The first invoice for a signed option, or null when its price has no
 * figure. A deposit says so in its description, so the client's invoice
 * reads as the first of two rather than the whole bill.
 */
export const firstInvoiceFor = (
  proposalTitle: string,
  pkg: Pick<ProposalPackage, "name" | "payment" | "price">
): InvoiceDraft | null => {
  const total = priceToCents(pkg.price);
  if (!total) {
    return null;
  }
  const pct = firstInstalmentPercent(pkg.payment);
  const amountCents = Math.round((total * pct) / 100);
  const description =
    pct < 100
      ? `${proposalTitle}: ${pkg.name}, ${pct}% deposit`
      : `${proposalTitle}: ${pkg.name}`;
  return { amountCents, description };
};

type Sql = ReturnType<typeof getSql>;

export interface NewInvoice {
  amountCents: number;
  customerEmail: string;
  customerName: string;
  description: string;
  dueDays?: number;
  proposalId: string | null;
}

export const MAX_INVOICE_CENTS = 100_000_000;
export const DEFAULT_DUE_DAYS = 14;

/** Inserts a local draft; nothing reaches Stripe until it is sent. */
export const insertDraft = async (
  sql: Sql,
  input: NewInvoice
): Promise<InvoiceDto> => {
  const rows = (await sql`
    INSERT INTO invoices
      (proposal_id, description, amount_cents, due_days, customer_email, customer_name)
    VALUES (
      ${input.proposalId}, ${input.description}, ${input.amountCents},
      ${input.dueDays ?? DEFAULT_DUE_DAYS}, ${input.customerEmail},
      ${input.customerName}
    )
    RETURNING ${sql.unsafe(INVOICE_COLUMNS)}
  `) as InvoiceRow[];
  const [row] = rows;
  if (!row) {
    throw new Error("Invoice insert returned nothing");
  }
  return rowToInvoice(row);
};
