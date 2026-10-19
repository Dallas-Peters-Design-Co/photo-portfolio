import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import {
  formatMoney,
  INVOICE_COLUMNS,
  type InvoiceRow,
  MAX_INVOICE_CENTS,
  rowToInvoice,
} from "../_lib/invoices.js";
import { notify } from "../_lib/notify.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { cleanEmail } from "../_lib/proposals.js";
import {
  createAndSendInvoice,
  StripeError,
  StripeNotConfiguredError,
  voidInvoice,
} from "../_lib/stripe.js";

/**
 * One invoice. Admin only.
 *
 * PATCH edits a draft (amount, description, due days, who it goes to);
 * DELETE throws a draft away; POST {action: "send"} creates it in Stripe and
 * has Stripe email it, POST {action: "void"} cancels a sent one. Once sent,
 * the amount is Stripe's to keep: an open invoice is voided and a new one
 * drafted, never edited.
 */

type Sql = ReturnType<typeof getSql>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION = 300;

const load = async (sql: Sql, id: string): Promise<InvoiceRow | null> => {
  const rows = (await sql`
    SELECT ${sql.unsafe(INVOICE_COLUMNS)} FROM invoices WHERE id = ${id}
  `) as InvoiceRow[];
  return rows[0] ?? null;
};

const proposalOf = async (
  sql: Sql,
  id: string | null
): Promise<{ slug: string; title: string } | null> => {
  if (!id) {
    return null;
  }
  const rows = (await sql`
    SELECT slug, title FROM proposals WHERE id = ${id}
  `) as { slug: string; title: string }[];
  return rows[0] ?? null;
};

const editDraft = async (
  sql: Sql,
  req: VercelRequest,
  res: VercelResponse,
  current: InvoiceRow
) => {
  if (current.status !== "draft") {
    return res.status(409).json({
      error: "Only a draft can be edited. Void it and draft another.",
    });
  }
  const body = parseJsonBody(req.body);
  const amount =
    body.amountCents === undefined
      ? current.amount_cents
      : Math.round(Number(body.amountCents));
  if (!(amount > 0 && amount <= MAX_INVOICE_CENTS)) {
    return res.status(400).json({ error: "Enter an amount above zero." });
  }
  const description =
    typeof body.description === "string"
      ? sanitizeText(body.description).slice(0, MAX_DESCRIPTION) ||
        current.description
      : current.description;
  const dueDays = Number.isInteger(body.dueDays)
    ? Math.min(365, Math.max(0, body.dueDays as number))
    : current.due_days;
  const email =
    body.customerEmail === undefined
      ? current.customer_email
      : (cleanEmail(body.customerEmail) ?? "");
  const name =
    typeof body.customerName === "string"
      ? sanitizeText(body.customerName).slice(0, 120)
      : current.customer_name;
  const rows = (await sql`
    UPDATE invoices SET
      amount_cents = ${amount}, description = ${description},
      due_days = ${dueDays}, customer_email = ${email},
      customer_name = ${name}, updated_at = now()
    WHERE id = ${current.id} AND status = 'draft'
    RETURNING ${sql.unsafe(INVOICE_COLUMNS)}
  `) as InvoiceRow[];
  const [row] = rows;
  return row
    ? res.status(200).json(rowToInvoice(row))
    : res.status(409).json({ error: "It was sent in the meantime." });
};

const send = async (sql: Sql, res: VercelResponse, current: InvoiceRow) => {
  if (current.status !== "draft") {
    return res.status(409).json({ error: "This invoice was already sent." });
  }
  if (!current.customer_email) {
    return res
      .status(400)
      .json({ error: "Add the client's email to the invoice first." });
  }
  const sent = await createAndSendInvoice({
    amountCents: current.amount_cents,
    currency: current.currency,
    customerEmail: current.customer_email,
    customerName: current.customer_name,
    description: current.description,
    dueDays: current.due_days,
    invoiceId: current.id,
    proposalId: current.proposal_id,
  });
  const rows = (await sql`
    UPDATE invoices SET
      status = ${sent.status}, stripe_invoice_id = ${sent.id},
      stripe_customer_id = ${sent.customer}, number = ${sent.number},
      hosted_url = ${sent.hosted_invoice_url}, pdf_url = ${sent.invoice_pdf},
      sent_at = now(), updated_at = now()
    WHERE id = ${current.id}
    RETURNING ${sql.unsafe(INVOICE_COLUMNS)}
  `) as InvoiceRow[];
  const [row] = rows;
  const proposal = await proposalOf(sql, current.proposal_id);
  await notify(sql, {
    body: `${formatMoney(current.amount_cents, current.currency)} to ${current.customer_email}${sent.number ? `, invoice ${sent.number}` : ""}.`,
    dedupeKey: `invoice-sent:${current.id}`,
    email: false,
    kind: "invoice.sent",
    meta: { invoiceId: current.id },
    subjectId: current.proposal_id,
    subjectType: "proposal",
    title: proposal ? `Invoice sent for "${proposal.title}"` : "Invoice sent",
    url: proposal ? `/admin/proposals/${proposal.slug}` : "/admin/proposals",
  });
  return res.status(200).json(row ? rowToInvoice(row) : rowToInvoice(current));
};

const cancel = async (sql: Sql, res: VercelResponse, current: InvoiceRow) => {
  if (current.status !== "open" || !current.stripe_invoice_id) {
    return res
      .status(409)
      .json({ error: "Only a sent, unpaid invoice can be voided." });
  }
  await voidInvoice(current.stripe_invoice_id);
  const rows = (await sql`
    UPDATE invoices SET status = 'void', updated_at = now()
    WHERE id = ${current.id}
    RETURNING ${sql.unsafe(INVOICE_COLUMNS)}
  `) as InvoiceRow[];
  const [row] = rows;
  return res.status(200).json(row ? rowToInvoice(row) : rowToInvoice(current));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id =
    typeof req.query.id === "string" ? req.query.id : req.query.id?.[0];
  if (!(id && UUID.test(id))) {
    return res.status(400).json({ error: "Missing invoice id" });
  }

  try {
    const sql = getSql();
    const current = await load(sql, id);
    if (!current) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (req.method === "PATCH") {
      return await editDraft(sql, req, res, current);
    }
    if (req.method === "DELETE") {
      if (current.status !== "draft") {
        return res
          .status(409)
          .json({ error: "A sent invoice is voided, not deleted." });
      }
      await sql`DELETE FROM invoices WHERE id = ${id} AND status = 'draft'`;
      return res.status(204).end();
    }
    if (req.method === "POST") {
      const { action } = parseJsonBody(req.body);
      if (action === "send") {
        return await send(sql, res, current);
      }
      if (action === "void") {
        return await cancel(sql, res, current);
      }
      return res.status(400).json({ error: "Unknown action" });
    }
    res.setHeader("Allow", "PATCH, DELETE, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    if (e instanceof StripeNotConfiguredError) {
      return res.status(503).json({
        error: "Stripe is not set up yet. Add STRIPE_SECRET_KEY in Vercel.",
      });
    }
    if (e instanceof StripeError) {
      console.error("[invoice stripe]", e.status, e.message);
      return res.status(502).json({ error: `Stripe: ${e.message}` });
    }
    console.error("[invoice]", e);
    return res.status(500).json({ error: "Could not update the invoice" });
  }
}
