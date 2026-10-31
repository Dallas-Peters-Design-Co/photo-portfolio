import {
  type ContractDoc,
  type ContractStatus,
  sanitizeContractDoc,
} from "../../config/contract.js";
import type { getSql } from "./db.js";
import { sendEmail } from "./email.js";
import { button, emailFrame, escapeHtml, P, SOFT } from "./emailLayout.js";
import { emailBrand, getSite } from "./site.js";

/**
 * Agreements: rows, the shape the client and admin see, and the two emails
 * (sent for signature; fully signed).
 */

type Sql = ReturnType<typeof getSql>;

export interface ContractRow {
  client_email: string | null;
  client_name: string;
  client_signed_at: string | null;
  client_signed_ip: string | null;
  client_signed_name: string | null;
  client_signed_title: string | null;
  created_at: string;
  doc: unknown;
  id: string;
  owner_signed_at: string | null;
  owner_signed_name: string | null;
  proposal_id: string | null;
  proposal_slug: string | null;
  sent_at: string | null;
  status: ContractStatus;
  title: string;
  updated_at: string;
}

export interface ContractSignature {
  at: string;
  name: string;
  title: string | null;
}

export interface ContractDto {
  clientEmail: string | null;
  clientName: string;
  clientSignature: ContractSignature | null;
  createdAt: string;
  doc: ContractDoc;
  id: string;
  ownerSignature: ContractSignature | null;
  proposalSlug: string | null;
  sentAt: string | null;
  status: ContractStatus;
  title: string;
  updatedAt: string;
}

export const CONTRACT_SELECT = `
  c.id, c.proposal_id, p.slug AS proposal_slug, c.title, c.client_name,
  c.client_email, c.doc, c.status, c.sent_at, c.client_signed_at,
  c.client_signed_name, c.client_signed_title, c.client_signed_ip,
  c.owner_signed_at, c.owner_signed_name, c.created_at, c.updated_at
  FROM contracts c LEFT JOIN proposals p ON p.id = c.proposal_id
`;

const iso = (v: string | null): string | null =>
  v ? new Date(v).toISOString() : null;

/** The IP address a signature came from is kept for the record, not shown. */
export const rowToContract = (row: ContractRow): ContractDto => ({
  clientEmail: row.client_email,
  clientName: row.client_name,
  clientSignature:
    row.client_signed_at && row.client_signed_name
      ? {
          at: iso(row.client_signed_at) as string,
          name: row.client_signed_name,
          title: row.client_signed_title,
        }
      : null,
  createdAt: iso(row.created_at) as string,
  doc: sanitizeContractDoc(row.doc),
  id: row.id,
  ownerSignature:
    row.owner_signed_at && row.owner_signed_name
      ? {
          at: iso(row.owner_signed_at) as string,
          name: row.owner_signed_name,
          title: null,
        }
      : null,
  proposalSlug: row.proposal_slug,
  sentAt: iso(row.sent_at),
  status: row.status,
  title: row.title,
  updatedAt: iso(row.updated_at) as string,
});

export const loadContract = async (
  sql: Sql,
  id: string
): Promise<ContractRow | null> => {
  const rows = (await sql`
    SELECT ${sql.unsafe(CONTRACT_SELECT)} WHERE c.id = ${id} LIMIT 1
  `) as ContractRow[];
  return rows[0] ?? null;
};

export const loadContractForProposal = async (
  sql: Sql,
  proposalId: string
): Promise<ContractRow | null> => {
  const rows = (await sql`
    SELECT ${sql.unsafe(CONTRACT_SELECT)} WHERE c.proposal_id = ${proposalId}
    LIMIT 1
  `) as ContractRow[];
  return rows[0] ?? null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID.test(v);

export const contractUrl = (id: string): string =>
  `https://${getSite().domain}/contract/${id}`;

/** To the client: the agreement is ready to sign. */
export const contractRequestEmail = (
  contract: ContractDto,
  note: string
): { html: string; subject: string; text: string } => {
  const site = getSite();
  const link = contractUrl(contract.id);
  const greeting = contract.clientName
    ? `Hi ${contract.clientName.split(" ")[0]},`
    : "Hi,";
  const lead =
    note ||
    "Here's the agreement for the work we discussed. It's the scope and price from the proposal, plus the usual terms. Read it over and sign at the link when you're ready.";
  const html = emailFrame({
    brand: emailBrand(site),
    content: `<p ${P}>${escapeHtml(greeting)}</p><p ${P}>${escapeHtml(lead)}</p>${button(link, "Review and sign")}<p ${SOFT}>${escapeHtml(link)}</p>`,
    kicker: "Agreement",
    preheader: lead,
    title: contract.title,
  });
  return {
    html,
    subject: `Agreement: ${contract.title}`,
    text: [greeting, lead, link].join("\n\n"),
  };
};

/** To both parties once it is countersigned. */
export const contractExecutedEmail = (
  contract: ContractDto
): { html: string; subject: string; text: string } => {
  const site = getSite();
  const link = contractUrl(contract.id);
  const lead =
    "The agreement is signed by both of us. A copy is at the link below, where you can save it as a PDF any time.";
  const html = emailFrame({
    brand: emailBrand(site),
    content: `<p ${P}>${escapeHtml(lead)}</p>${button(link, "View the signed agreement")}`,
    kicker: "Signed",
    preheader: lead,
    title: contract.title,
  });
  return {
    html,
    subject: `Signed: ${contract.title}`,
    text: [lead, link].join("\n\n"),
  };
};

export const sendContractEmail = (
  to: string,
  email: { html: string; subject: string; text: string },
  contractId: string
) =>
  sendEmail({
    ...email,
    replyTo: getSite().defaultAdminEmail,
    tags: [{ name: "subject", value: "contract" }],
    to,
  }).catch((e) => {
    console.error("[contract email]", contractId, e);
    return null;
  });
