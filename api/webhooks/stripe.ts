import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db.js";
import { formatMoney } from "../_lib/invoices.js";
import { type ActivityKind, notify } from "../_lib/notify.js";
import {
  headerValue,
  readRawBody,
  verifyStripe,
} from "../_lib/webhookSignature.js";

/**
 * Stripe's invoice events, keeping the local invoice in step and telling the
 * owner when money moves.
 *
 * An event finds its invoice by Stripe's invoice id, or by the
 * `invoice_id` metadata set when it was created; invoices made in the Stripe
 * dashboard by hand have neither and are ignored. Each event is recorded
 * once, keyed on Stripe's event id.
 *
 * Set up in Stripe: Developers → Webhooks → add
 * https://<domain>/api/webhooks/stripe with invoice.paid,
 * invoice.payment_failed, invoice.voided and invoice.marked_uncollectible,
 * and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */

export const config = { api: { bodyParser: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StripeInvoiceObject {
  amount_due?: number;
  amount_paid?: number;
  currency?: string;
  hosted_invoice_url?: string | null;
  id?: string;
  invoice_pdf?: string | null;
  metadata?: Record<string, string>;
  number?: string | null;
  status?: string;
}

interface StripeEvent {
  data?: { object?: StripeInvoiceObject };
  id?: string;
  type?: string;
}

/** What each handled event does to the local row, and what it tells. */
const HANDLED: Record<
  string,
  { kind: ActivityKind; status: string; verb: string } | undefined
> = {
  "invoice.marked_uncollectible": {
    kind: "invoice.voided",
    status: "uncollectible",
    verb: "was marked uncollectible",
  },
  "invoice.paid": { kind: "invoice.paid", status: "paid", verb: "was paid" },
  "invoice.payment_failed": {
    kind: "invoice.failed",
    status: "open",
    verb: "payment failed",
  },
  "invoice.voided": {
    kind: "invoice.voided",
    status: "void",
    verb: "was voided",
  },
};

interface LocalInvoice {
  amount_cents: number;
  currency: string;
  customer_name: string;
  id: string;
  proposal_id: string | null;
  slug: string | null;
  title: string | null;
}

type Handled = NonNullable<(typeof HANDLED)[string]>;
type Sql = ReturnType<typeof getSql>;

const findLocal = async (
  sql: Sql,
  invoice: StripeInvoiceObject
): Promise<LocalInvoice | null> => {
  const tagged = invoice.metadata?.invoice_id ?? "";
  const localId = UUID.test(tagged) ? tagged : null;
  const rows = (await sql`
    SELECT i.id, i.amount_cents, i.currency, i.customer_name, i.proposal_id,
      p.slug, p.title
    FROM invoices i LEFT JOIN proposals p ON p.id = i.proposal_id
    WHERE i.stripe_invoice_id = ${invoice.id ?? ""}
      OR (${localId}::uuid IS NOT NULL AND i.id = ${localId}::uuid)
    LIMIT 1
  `) as LocalInvoice[];
  return rows[0] ?? null;
};

/** Brings the local row in step with the event and tells the owner. */
const apply = async (
  sql: Sql,
  local: LocalInvoice,
  handled: Handled,
  invoice: StripeInvoiceObject,
  eventId: string
): Promise<void> => {
  const paid = handled.status === "paid";
  await sql`
    UPDATE invoices SET
      status = ${handled.status},
      stripe_invoice_id = COALESCE(stripe_invoice_id, ${invoice.id ?? null}),
      number = COALESCE(${invoice.number ?? null}, number),
      hosted_url = COALESCE(${invoice.hosted_invoice_url ?? null}, hosted_url),
      pdf_url = COALESCE(${invoice.invoice_pdf ?? null}, pdf_url),
      paid_at = CASE WHEN ${paid} THEN now() ELSE paid_at END,
      updated_at = now()
    WHERE id = ${local.id}
  `;
  const cents = paid
    ? (invoice.amount_paid ?? local.amount_cents)
    : local.amount_cents;
  const amount = formatMoney(cents, local.currency);
  const label = invoice.number ? `Invoice ${invoice.number}` : "An invoice";
  const on = local.title ? ` for "${local.title}"` : "";
  await notify(sql, {
    body: paid
      ? `${local.customer_name || "The client"} paid ${amount}.`
      : `${amount}${on}.`,
    dedupeKey: `stripe:${eventId}`,
    kind: handled.kind,
    meta: { invoiceId: local.id, stripeInvoiceId: invoice.id },
    subjectId: local.proposal_id,
    subjectType: "proposal",
    title: `${label} ${handled.verb}${on}`,
    url: local.slug ? `/admin/proposals/${local.slug}` : "/admin/proposals",
  });
};

const parse = (body: string): StripeEvent | null => {
  try {
    return JSON.parse(body) as StripeEvent;
  } catch {
    return null;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ error: "Webhook secret is not configured" });
  }
  const body = await readRawBody(req);
  const signature = headerValue(req.headers["stripe-signature"]);
  if (!verifyStripe(body, signature, secret)) {
    return res.status(401).json({ error: "Bad signature" });
  }
  const event = parse(body);
  if (!event) {
    return res.status(400).json({ error: "Body is not JSON" });
  }
  const handled = event.type ? HANDLED[event.type] : undefined;
  const invoice = event.data?.object;
  if (!(handled && invoice?.id && event.id)) {
    return res.status(200).json({ ignored: true });
  }

  try {
    const sql = getSql();
    const local = await findLocal(sql, invoice);
    if (!local) {
      return res.status(200).json({ ignored: true });
    }
    await apply(sql, local, handled, invoice, event.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[webhook stripe]", e);
    // A 500 makes Stripe retry, which is what an unreachable database wants.
    return res.status(500).json({ error: "Could not record the event" });
  }
}
