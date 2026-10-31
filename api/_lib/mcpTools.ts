import { sanitizeProposalDoc } from "../../config/proposal.js";
import { loadContractForProposal, rowToContract } from "./contracts.js";
import type { getSql } from "./db.js";
import { sanitizeText } from "./httpUrl.js";
import {
  cleanLines,
  DEFAULT_DUE_DAYS,
  formatMoney,
  INVOICE_COLUMNS,
  type InvoiceRow,
  insertDraft,
  rowToInvoice,
  totalOf,
} from "./invoices.js";
import { type McpTool, ToolError } from "./mcp.js";
import { notify } from "./notify.js";
import {
  cleanEmail,
  PROPOSAL_SELECT,
  type ProposalRow,
  rowToSummary,
} from "./proposals.js";
import {
  REVIEW_SELECT,
  type ReviewRow,
  rowToReviewSummary,
} from "./reviews.js";

/**
 * What Claude can do with the site through the MCP connector. Reads cover the
 * business side (proposals, agreements, invoices, reviews, activity) and the
 * photo library; the one write is an invoice draft, which still has to be
 * sent from the admin. Sending, signing and deleting stay in the admin on
 * purpose: those reach clients or can't be undone.
 */

type Sql = ReturnType<typeof getSql>;
export interface ToolCtx {
  sql: Sql;
}

const str = (v: unknown, max = 200): string =>
  typeof v === "string" ? sanitizeText(v).slice(0, max) : "";

const limitOf = (v: unknown, fallback: number, max: number): number =>
  Number.isInteger(v) ? Math.min(max, Math.max(1, v as number)) : fallback;

/** A TipTap document (or plain string) as readable text. */
export const richToText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const node = value as { content?: unknown[]; text?: string; type?: string };
  if (typeof node.text === "string") {
    return node.text;
  }
  const inner = (node.content ?? []).map(richToText).join("");
  const block = new Set(["paragraph", "heading", "listItem", "blockquote"]);
  return block.has(node.type ?? "") ? `${inner}\n` : inner;
};

const proposalBySlug = async (sql: Sql, slug: string) => {
  const rows = (await sql`
    SELECT ${sql.unsafe(PROPOSAL_SELECT)} WHERE p.slug = ${slug}
  `) as ProposalRow[];
  const [row] = rows;
  if (!row) {
    throw new ToolError(`No proposal with the slug "${slug}".`);
  }
  return row;
};

const readableProposal = (row: ProposalRow) => {
  const doc = sanitizeProposalDoc(row.doc);
  return {
    ...rowToSummary(row),
    addOns: doc.addOns,
    closing: richToText(doc.closing).trim(),
    intro: richToText(doc.intro).trim(),
    options: doc.packages.map((p) => ({
      bestFor: p.bestFor,
      includes: p.includes,
      name: p.name,
      payment: p.payment,
      price: p.price,
      priceNote: p.priceNote,
    })),
    process: doc.process,
    publicUrl: `/proposal/${row.slug}`,
    sections: doc.sections.map((s) => ({
      body: richToText(s.body).trim(),
      heading: s.heading,
    })),
    summary: richToText(doc.summary).trim(),
    terms: doc.terms,
    validUntil: doc.validUntil,
  };
};

const overview: McpTool<ToolCtx> = {
  description:
    "A snapshot of the business: proposals by status and how many were accepted, invoices outstanding and paid in the last 90 days, unread activity, reviews, and the photo library size.",
  inputSchema: { properties: {}, type: "object" },
  name: "site_overview",
  run: async (_args, { sql }) => {
    const [counts] = (await sql`
      SELECT
        (SELECT count(*)::int FROM proposals WHERE status = 'draft') AS proposals_draft,
        (SELECT count(*)::int FROM proposals WHERE status = 'published') AS proposals_published,
        (SELECT count(*)::int FROM proposals WHERE accepted_at IS NOT NULL) AS proposals_accepted,
        (SELECT coalesce(sum(amount_cents), 0)::bigint FROM invoices WHERE status = 'open') AS outstanding_cents,
        (SELECT count(*)::int FROM invoices WHERE status = 'open') AS invoices_open,
        (SELECT count(*)::int FROM invoices WHERE status = 'draft') AS invoices_draft,
        (SELECT coalesce(sum(amount_cents), 0)::bigint FROM invoices
          WHERE status = 'paid' AND paid_at > now() - interval '90 days') AS paid_90d_cents,
        (SELECT count(*)::int FROM activity WHERE read_at IS NULL) AS unread_activity,
        (SELECT count(*)::int FROM reviews) AS reviews,
        (SELECT count(*)::int FROM photos) AS photos,
        (SELECT count(*)::int FROM photos WHERE is_published) AS photos_published
    `) as Record<string, number | string>[];
    if (!counts) {
      return {};
    }
    return {
      ...counts,
      outstanding: formatMoney(Number(counts.outstanding_cents)),
      paidLast90Days: formatMoney(Number(counts.paid_90d_cents)),
    };
  },
};

const listProposals: McpTool<ToolCtx> = {
  description:
    "Every proposal, newest first: title, client, status (draft or published), whether it was sent and accepted, and which option the client chose.",
  inputSchema: {
    properties: {
      status: { enum: ["draft", "published"], type: "string" },
    },
    type: "object",
  },
  name: "list_proposals",
  run: async ({ status }, { sql }) => {
    const rows = (await sql`
      SELECT ${sql.unsafe(PROPOSAL_SELECT)}
      ORDER BY p.updated_at DESC LIMIT 200
    `) as ProposalRow[];
    return rows.filter((r) => !status || r.status === status).map(rowToSummary);
  },
};

const getProposal: McpTool<ToolCtx> = {
  description:
    "One proposal in full, as readable text: summary, options with prices and what each includes, add-ons, process, terms, and the acceptance if the client signed.",
  inputSchema: {
    properties: {
      slug: { description: "From list_proposals", type: "string" },
    },
    required: ["slug"],
    type: "object",
  },
  name: "get_proposal",
  run: async ({ slug }, { sql }) =>
    readableProposal(await proposalBySlug(sql, str(slug).toLowerCase())),
};

const getAgreement: McpTool<ToolCtx> = {
  description:
    "The services agreement drafted from a proposal, with its status (draft, sent, signed, countersigned), parties, scope and clauses. Returns null when none has been drafted yet; drafting happens in the admin.",
  inputSchema: {
    properties: { proposal: { description: "Proposal slug", type: "string" } },
    required: ["proposal"],
    type: "object",
  },
  name: "get_agreement",
  run: async ({ proposal }, { sql }) => {
    const p = await proposalBySlug(sql, str(proposal).toLowerCase());
    const row = await loadContractForProposal(sql, p.id);
    return row ? rowToContract(row) : null;
  },
};

const listInvoices: McpTool<ToolCtx> = {
  description:
    "Invoices, newest first, with client, lines, total and status (draft, open = sent and unpaid, paid, void, uncollectible) and the client's pay link once sent.",
  inputSchema: {
    properties: {
      limit: { maximum: 200, minimum: 1, type: "integer" },
      status: {
        enum: ["draft", "open", "paid", "void", "uncollectible"],
        type: "string",
      },
    },
    type: "object",
  },
  name: "list_invoices",
  run: async ({ status, limit }, { sql }) => {
    const n = limitOf(limit, 50, 200);
    const rows = (
      typeof status === "string"
        ? await sql`
            SELECT ${sql.unsafe(INVOICE_COLUMNS)} FROM invoices
            WHERE status = ${status} ORDER BY created_at DESC LIMIT ${n}`
        : await sql`
            SELECT ${sql.unsafe(INVOICE_COLUMNS)} FROM invoices
            ORDER BY created_at DESC LIMIT ${n}`
    ) as InvoiceRow[];
    return rows.map(rowToInvoice);
  },
};

const draftInvoice: McpTool<ToolCtx> = {
  description:
    "Save an invoice as a draft on the site (nothing is sent). Dallas reviews and sends it from Admin → Invoices, which creates it in Stripe and emails the client a pay link. Amounts are in cents.",
  inputSchema: {
    properties: {
      customerEmail: { type: "string" },
      customerName: { type: "string" },
      dueDays: { maximum: 365, minimum: 0, type: "integer" },
      lines: {
        items: {
          properties: {
            amountCents: { minimum: 1, type: "integer" },
            description: { type: "string" },
          },
          required: ["description", "amountCents"],
          type: "object",
        },
        minItems: 1,
        type: "array",
      },
      memo: { type: "string" },
    },
    required: ["customerName", "customerEmail", "lines"],
    type: "object",
  },
  name: "draft_invoice",
  run: async (args, { sql }) => {
    const lines = cleanLines(args.lines);
    if (lines.length === 0) {
      throw new ToolError(
        "Give at least one line with a description and an amount."
      );
    }
    const email = cleanEmail(args.customerEmail);
    if (!email) {
      throw new ToolError("That client email doesn't look right.");
    }
    const invoice = await insertDraft(sql, {
      amountCents: totalOf(lines),
      customerEmail: email,
      customerName: str(args.customerName, 120),
      description: lines
        .map((l) => l.description)
        .join("; ")
        .slice(0, 300),
      dueDays: Number.isInteger(args.dueDays)
        ? Math.min(365, Math.max(0, args.dueDays as number))
        : DEFAULT_DUE_DAYS,
      lines,
      memo: str(args.memo, 1000),
      proposalId: null,
    });
    await notify(sql, {
      email: false,
      kind: "invoice.drafted",
      subjectId: invoice.id,
      subjectType: "invoice",
      title: `Invoice drafted by Claude for ${invoice.customerName || email}`,
      url: "/admin/invoices",
    });
    return { ...invoice, next: "Review and send it at /admin/invoices." };
  },
  writes: true,
};

const listReviews: McpTool<ToolCtx> = {
  description:
    "Design reviews made for clients, newest first, with how many screens and notes each has and whether it was sent.",
  inputSchema: { properties: {}, type: "object" },
  name: "list_reviews",
  run: async (_args, { sql }) => {
    const rows = (await sql`
      SELECT ${sql.unsafe(REVIEW_SELECT)} ORDER BY r.updated_at DESC LIMIT 100
    `) as ReviewRow[];
    return rows.map(rowToReviewSummary);
  },
};

const recentActivity: McpTool<ToolCtx> = {
  description:
    "The site's activity feed, newest first: proposals viewed or accepted, agreements signed, invoices paid, review comments, and so on.",
  inputSchema: {
    properties: {
      limit: { maximum: 100, minimum: 1, type: "integer" },
      unreadOnly: { type: "boolean" },
    },
    type: "object",
  },
  name: "recent_activity",
  run: async ({ limit, unreadOnly }, { sql }) => {
    const n = limitOf(limit, 30, 100);
    const rows = (await sql`
      SELECT kind, title, body, url, created_at, read_at IS NOT NULL AS read
      FROM activity
      WHERE ${unreadOnly !== true} OR read_at IS NULL
      ORDER BY created_at DESC LIMIT ${n}
    `) as Record<string, unknown>[];
    return rows;
  },
};

const searchPhotos: McpTool<ToolCtx> = {
  description:
    "Search the photo library by words in the title or alt text, optionally within a category. Returns image URLs, size, category and whether each is published or featured.",
  inputSchema: {
    properties: {
      category: { description: "Category slug", type: "string" },
      limit: { maximum: 100, minimum: 1, type: "integer" },
      query: { type: "string" },
    },
    type: "object",
  },
  name: "search_photos",
  run: async ({ query, category, limit }, { sql }) => {
    const q = `%${str(query, 100).replaceAll(/[%_\\]/g, "")}%`;
    const cat = str(category, 100);
    const n = limitOf(limit, 24, 100);
    return await sql`
      SELECT p.id, p.title, p.alt, p.url, p.width, p.height, p.is_published,
        p.is_featured, c.slug AS category
      FROM photos p INNER JOIN categories c ON c.id = p.category_id
      WHERE (p.title ILIKE ${q} OR p.alt ILIKE ${q})
        AND (${cat} = '' OR c.slug = ${cat})
      ORDER BY p.created_at DESC LIMIT ${n}
    `;
  },
};

export const SITE_TOOLS: McpTool<ToolCtx>[] = [
  overview,
  listProposals,
  getProposal,
  getAgreement,
  listInvoices,
  draftInvoice,
  listReviews,
  recentActivity,
  searchPhotos,
];
