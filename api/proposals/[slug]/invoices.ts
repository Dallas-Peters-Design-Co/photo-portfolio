import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../../_lib/auth.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { sanitizeText } from "../../_lib/httpUrl.js";
import {
  DEFAULT_DUE_DAYS,
  INVOICE_COLUMNS,
  type InvoiceRow,
  insertDraft,
  MAX_INVOICE_CENTS,
  rowToInvoice,
} from "../../_lib/invoices.js";
import { notify } from "../../_lib/notify.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import { cleanEmail } from "../../_lib/proposals.js";
import { stripeConfigured } from "../../_lib/stripe.js";

/**
 * A proposal's invoices: list them, or draft a new one. Admin only.
 *
 * A draft is local until it is sent (api/invoices/[id].ts), so it can be
 * drafted with no Stripe keys at all. The response says whether Stripe is
 * configured, so the editor can explain why Send would not work yet.
 */

const MAX_DESCRIPTION = 300;

type Sql = ReturnType<typeof getSql>;

interface ProposalForInvoice {
  accepted_name: string | null;
  client_email: string | null;
  client_name: string;
  id: string;
  title: string;
}

const list = async (
  sql: Sql,
  res: VercelResponse,
  proposal: ProposalForInvoice
) => {
  const rows = (await sql`
    SELECT ${sql.unsafe(INVOICE_COLUMNS)} FROM invoices
    WHERE proposal_id = ${proposal.id}
    ORDER BY created_at
  `) as InvoiceRow[];
  return res.status(200).json({
    invoices: rows.map(rowToInvoice),
    stripe: stripeConfigured(),
  });
};

const create = async (
  sql: Sql,
  req: VercelRequest,
  res: VercelResponse,
  proposal: ProposalForInvoice,
  slug: string
) => {
  const body = parseJsonBody(req.body);
  const amountCents = Math.round(Number(body.amountCents));
  if (!(amountCents > 0 && amountCents <= MAX_INVOICE_CENTS)) {
    return res.status(400).json({ error: "Enter an amount above zero." });
  }
  const description =
    typeof body.description === "string"
      ? sanitizeText(body.description).slice(0, MAX_DESCRIPTION)
      : "";
  const dueDays = Number.isInteger(body.dueDays)
    ? Math.min(365, Math.max(0, body.dueDays as number))
    : DEFAULT_DUE_DAYS;
  const invoice = await insertDraft(sql, {
    amountCents,
    customerEmail:
      cleanEmail(body.customerEmail) ?? proposal.client_email ?? "",
    customerName: proposal.accepted_name ?? proposal.client_name,
    description: description || proposal.title,
    dueDays,
    proposalId: proposal.id,
  });
  await notify(sql, {
    body: invoice.description,
    email: false,
    kind: "invoice.drafted",
    subjectId: proposal.id,
    subjectType: "proposal",
    title: `Drafted an invoice for "${proposal.title}"`,
    url: `/admin/proposals/${slug}`,
  });
  return res.status(201).json(invoice);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const raw =
    typeof req.query.slug === "string" ? req.query.slug : req.query.slug?.[0];
  const slug = raw?.trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Missing proposal address" });
  }

  try {
    const sql = getSql();
    const found = (await sql`
      SELECT id, title, client_name, client_email, accepted_name
      FROM proposals WHERE slug = ${slug} LIMIT 1
    `) as ProposalForInvoice[];
    const [proposal] = found;
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    if (req.method === "GET") {
      return await list(sql, res, proposal);
    }
    if (req.method === "POST") {
      return await create(sql, req, res, proposal, slug);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[proposal invoices]", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("invoices")) {
      return res.status(503).json({
        error:
          "Database schema is out of date. Run pnpm db:migrate against this deployment.",
      });
    }
    return res.status(500).json({ error: "Could not load invoices" });
  }
}
