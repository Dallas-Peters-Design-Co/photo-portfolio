import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import {
  cleanLines,
  DEFAULT_DUE_DAYS,
  INVOICE_COLUMNS,
  type InvoiceLine,
  type InvoiceRow,
  insertDraft,
  rowToInvoice,
  totalOf,
} from "../_lib/invoices.js";
import { notify } from "../_lib/notify.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { cleanEmail } from "../_lib/proposals.js";
import { stripeConfigured } from "../_lib/stripe.js";

/**
 * Every invoice, and the templates they can start from. Admin only.
 *
 *   GET  /api/invoices                     {invoices, templates, stripe}
 *   POST /api/invoices {action:"create", customerEmail, customerName, lines,
 *                       dueDays?, memo?, proposalId?}   a local draft
 *   POST /api/invoices {action:"saveTemplate", id?, name, lines, dueDays, memo}
 *   POST /api/invoices {action:"deleteTemplate", id}
 *
 * Sending, editing and voiding one invoice stay in api/invoices/[id].ts. One
 * function for the rest keeps the project under Vercel's function limit.
 */

type Sql = ReturnType<typeof getSql>;

interface TemplateRow {
  due_days: number;
  id: string;
  lines: unknown;
  memo: string;
  name: string;
}

export interface InvoiceTemplateDto {
  dueDays: number;
  id: string;
  lines: InvoiceLine[];
  memo: string;
  name: string;
}

const toTemplate = (row: TemplateRow): InvoiceTemplateDto => ({
  dueDays: row.due_days,
  id: row.id,
  lines: cleanLines(row.lines),
  memo: row.memo,
  name: row.name,
});

const dueDaysOf = (v: unknown): number =>
  Number.isInteger(v)
    ? Math.min(365, Math.max(0, v as number))
    : DEFAULT_DUE_DAYS;

const text = (v: unknown, max: number): string =>
  typeof v === "string" ? sanitizeText(v).slice(0, max) : "";

const UUID = /^[0-9a-f-]{36}$/i;

const list = async (sql: Sql, res: VercelResponse) => {
  const invoices = (await sql`
    SELECT ${sql.unsafe(INVOICE_COLUMNS)} FROM invoices
    ORDER BY created_at DESC LIMIT 200
  `) as InvoiceRow[];
  const templates = (await sql`
    SELECT id, name, lines, due_days, memo FROM invoice_templates
    ORDER BY name
  `) as TemplateRow[];
  return res.status(200).json({
    invoices: invoices.map(rowToInvoice),
    stripe: stripeConfigured(),
    templates: templates.map(toTemplate),
  });
};

const create = async (
  sql: Sql,
  res: VercelResponse,
  body: Record<string, unknown>
) => {
  const lines = cleanLines(body.lines);
  if (lines.length === 0) {
    return res.status(400).json({
      error: "Add at least one line with a description and an amount.",
    });
  }
  const proposalId =
    typeof body.proposalId === "string" && UUID.test(body.proposalId)
      ? body.proposalId
      : null;
  const invoice = await insertDraft(sql, {
    amountCents: totalOf(lines),
    customerEmail: cleanEmail(body.customerEmail) ?? "",
    customerName: text(body.customerName, 120),
    description: lines
      .map((l) => l.description)
      .join("; ")
      .slice(0, 300),
    dueDays: dueDaysOf(body.dueDays),
    lines,
    memo: text(body.memo, 1000),
    proposalId,
  });
  await notify(sql, {
    email: false,
    kind: "invoice.drafted",
    subjectId: invoice.id,
    subjectType: "invoice",
    title: `Invoice drafted for ${invoice.customerName || invoice.customerEmail || "a client"}`,
    url: "/admin/invoices",
  });
  return res.status(201).json(invoice);
};

const saveTemplate = async (
  sql: Sql,
  res: VercelResponse,
  body: Record<string, unknown>
) => {
  const name = text(body.name, 120);
  if (!name) {
    return res.status(400).json({ error: "Give the template a name." });
  }
  const lines = JSON.stringify(cleanLines(body.lines));
  const dueDays = dueDaysOf(body.dueDays);
  const memo = text(body.memo, 1000);
  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
  const rows = (
    id
      ? await sql`
          UPDATE invoice_templates SET name = ${name}, lines = ${lines}::jsonb,
            due_days = ${dueDays}, memo = ${memo}, updated_at = now()
          WHERE id = ${id}
          RETURNING id, name, lines, due_days, memo
        `
      : await sql`
          INSERT INTO invoice_templates (name, lines, due_days, memo)
          VALUES (${name}, ${lines}::jsonb, ${dueDays}, ${memo})
          RETURNING id, name, lines, due_days, memo
        `
  ) as TemplateRow[];
  const [row] = rows;
  return row
    ? res.status(id ? 200 : 201).json(toTemplate(row))
    : res.status(404).json({ error: "Template not found" });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const sql = getSql();
    if (req.method === "GET") {
      return await list(sql, res);
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const body = parseJsonBody(req.body);
    switch (body.action) {
      case "create":
        return await create(sql, res, body);
      case "saveTemplate":
        return await saveTemplate(sql, res, body);
      case "deleteTemplate": {
        const id =
          typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
        if (id) {
          await sql`DELETE FROM invoice_templates WHERE id = ${id}`;
        }
        return res.status(204).end();
      }
      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    console.error("[invoices]", e);
    return res.status(500).json({ error: "Could not load invoices" });
  }
}
