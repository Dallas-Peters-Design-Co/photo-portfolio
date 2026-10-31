import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  draftContractFromProposal,
  MAX_CONTRACT_TITLE,
  sanitizeContractDoc,
} from "../../config/contract.js";
import { MAX_CLIENT_NAME, sanitizeProposalDoc } from "../../config/proposal.js";
import { getBearerUser } from "../_lib/auth.js";
import {
  type ContractDto,
  type ContractRow,
  contractExecutedEmail,
  contractRequestEmail,
  isUuid,
  loadContract,
  loadContractForProposal,
  rowToContract,
  sendContractEmail,
} from "../_lib/contracts.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import { notify } from "../_lib/notify.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import {
  cleanEmail,
  PROPOSAL_SELECT,
  type ProposalRow,
  rowToDto,
} from "../_lib/proposals.js";
import { getSite } from "../_lib/site.js";

/**
 * An agreement, by id.
 *
 *   GET  /api/contracts/<id>                 the agreement (admin: any state;
 *                                            anyone with the link: once sent)
 *   GET  /api/contracts/for?proposal=<slug>  admin: the proposal's agreement
 *   POST /api/contracts/new  {action:"create", proposal}       admin
 *   POST /api/contracts/<id> {action:"update", doc, title, …}  admin, draft only
 *   POST /api/contracts/<id> {action:"send", note?}             admin
 *   POST /api/contracts/<id> {action:"sign", name, title?, agree} the client
 *   POST /api/contracts/<id> {action:"countersign"}              admin
 *   POST /api/contracts/<id> {action:"reopen"}                  admin, unsigned
 *   DELETE /api/contracts/<id>                                   admin, unsigned
 *
 * One function for all of it, because the project is near Vercel's function
 * limit. The signing is public on the same terms as the proposal's: the
 * unguessable id is the permission, and it records the typed name, the time
 * and the address it came from, once.
 */

type Sql = ReturnType<typeof getSql>;
type Res = VercelResponse;

const field = (v: unknown, max: number): string =>
  typeof v === "string" ? sanitizeText(v).slice(0, max) : "";

const proposalBySlug = async (sql: Sql, slug: string) => {
  const rows = (await sql`
    SELECT ${sql.unsafe(PROPOSAL_SELECT)} WHERE p.slug = ${slug} LIMIT 1
  `) as ProposalRow[];
  return rows[0] ?? null;
};

const fresh = async (sql: Sql, id: string): Promise<ContractDto> =>
  rowToContract((await loadContract(sql, id)) as ContractRow);

const create = async (sql: Sql, res: Res, body: Record<string, unknown>) => {
  const slug = field(body.proposal, 200).toLowerCase();
  const proposal = slug ? await proposalBySlug(sql, slug) : null;
  if (!proposal) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  const existing = await loadContractForProposal(sql, proposal.id);
  if (existing) {
    return res.status(200).json(rowToContract(existing));
  }
  const dto = rowToDto(proposal);
  const site = getSite();
  const doc = draftContractFromProposal({
    clientCompany: dto.brand?.name ?? "",
    clientName: proposal.accepted_name || proposal.client_name,
    doc: sanitizeProposalDoc(proposal.doc),
    option: proposal.accepted_option ?? null,
    ownerBusiness: site.tagline,
    ownerName: site.name,
  });
  const rows = (await sql`
    INSERT INTO contracts (proposal_id, title, client_name, client_email, doc)
    VALUES (${proposal.id}, ${`Services agreement: ${proposal.title}`.slice(0, MAX_CONTRACT_TITLE)},
      ${proposal.accepted_name || proposal.client_name},
      ${proposal.client_email ?? null}, ${JSON.stringify(doc)}::jsonb)
    ON CONFLICT (proposal_id) DO NOTHING
    RETURNING id
  `) as { id: string }[];
  const id =
    rows[0]?.id ?? (await loadContractForProposal(sql, proposal.id))?.id;
  return res.status(201).json(await fresh(sql, id as string));
};

const update = async (
  sql: Sql,
  res: Res,
  row: ContractRow,
  body: Record<string, unknown>
) => {
  if (row.status !== "draft") {
    return res
      .status(409)
      .json({ error: "Reopen the agreement as a draft to edit it." });
  }
  const title = field(body.title, MAX_CONTRACT_TITLE) || row.title;
  const clientName =
    body.clientName === undefined
      ? row.client_name
      : field(body.clientName, MAX_CLIENT_NAME);
  const clientEmail =
    body.clientEmail === undefined
      ? row.client_email
      : cleanEmail(body.clientEmail);
  const doc =
    body.doc === undefined
      ? sanitizeContractDoc(row.doc)
      : sanitizeContractDoc(body.doc);
  await sql`
    UPDATE contracts SET title = ${title}, client_name = ${clientName},
      client_email = ${clientEmail}, doc = ${JSON.stringify(doc)}::jsonb,
      updated_at = now()
    WHERE id = ${row.id} AND status = 'draft'
  `;
  return res.status(200).json(await fresh(sql, row.id));
};

const send = async (
  sql: Sql,
  res: Res,
  row: ContractRow,
  body: Record<string, unknown>
) => {
  if (row.status === "signed" || row.status === "countersigned") {
    return res.status(409).json({ error: "Already signed." });
  }
  if (!row.client_email) {
    return res.status(400).json({ error: "Add the client's email first." });
  }
  await sql`
    UPDATE contracts SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE id = ${row.id}
  `;
  const dto = await fresh(sql, row.id);
  const emailed = await sendContractEmail(
    row.client_email,
    contractRequestEmail(dto, field(body.note, 2000)),
    row.id
  );
  await notify(sql, {
    email: false,
    kind: "contract.sent",
    meta: { contractId: row.id },
    subjectId: row.proposal_id ?? row.id,
    subjectType: row.proposal_id ? "proposal" : "contract",
    title: `Agreement sent to ${row.client_name || row.client_email}`,
    url: row.proposal_slug
      ? `/admin/proposals/${row.proposal_slug}`
      : "/admin/proposals",
  });
  return res.status(200).json({ ...dto, emailed: emailed !== null });
};

const clientIp = (req: VercelRequest): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  return first || req.socket?.remoteAddress || null;
};

const sign = async (
  sql: Sql,
  req: VercelRequest,
  res: Res,
  row: ContractRow,
  body: Record<string, unknown>
) => {
  const name = field(body.name, MAX_CLIENT_NAME);
  if (!name) {
    return res.status(400).json({ error: "Type your full name to sign." });
  }
  if (body.agree !== true) {
    return res.status(400).json({ error: "Tick the box to agree first." });
  }
  const signed = (await sql`
    UPDATE contracts SET status = 'signed', client_signed_at = now(),
      client_signed_name = ${name},
      client_signed_title = ${field(body.title, MAX_CLIENT_NAME) || null},
      client_signed_ip = ${clientIp(req)}, updated_at = now()
    WHERE id = ${row.id} AND status = 'sent'
    RETURNING id
  `) as { id: string }[];
  if (signed.length === 0) {
    const current = await fresh(sql, row.id);
    return res.status(409).json({
      contract: current,
      error:
        current.status === "draft"
          ? "This agreement isn't open for signing."
          : "This agreement is already signed.",
    });
  }
  await notify(sql, {
    body: "Countersign it in the admin to complete it.",
    dedupeKey: `contract.signed:${row.id}`,
    kind: "contract.signed",
    meta: { contractId: row.id },
    subjectId: row.proposal_id ?? row.id,
    subjectType: row.proposal_id ? "proposal" : "contract",
    title: `${name} signed "${row.title}"`,
    url: row.proposal_slug
      ? `/admin/proposals/${row.proposal_slug}`
      : "/admin/proposals",
  });
  return res.status(200).json(await fresh(sql, row.id));
};

const countersign = async (sql: Sql, res: Res, row: ContractRow) => {
  const site = getSite();
  const done = (await sql`
    UPDATE contracts SET status = 'countersigned', owner_signed_at = now(),
      owner_signed_name = ${site.name}, updated_at = now()
    WHERE id = ${row.id} AND status = 'signed'
    RETURNING id
  `) as { id: string }[];
  if (done.length === 0) {
    return res.status(409).json({
      error: "Only an agreement the client has signed can be countersigned.",
    });
  }
  const dto = await fresh(sql, row.id);
  const email = contractExecutedEmail(dto);
  await Promise.all([
    row.client_email
      ? sendContractEmail(row.client_email, email, row.id)
      : null,
    sendContractEmail(site.defaultAdminEmail, email, row.id),
  ]);
  await notify(sql, {
    dedupeKey: `contract.countersigned:${row.id}`,
    email: false,
    kind: "contract.countersigned",
    meta: { contractId: row.id },
    subjectId: row.proposal_id ?? row.id,
    subjectType: row.proposal_id ? "proposal" : "contract",
    title: `Agreement fully signed: ${row.title}`,
    url: row.proposal_slug
      ? `/admin/proposals/${row.proposal_slug}`
      : "/admin/proposals",
  });
  return res.status(200).json(dto);
};

const adminAction = (
  sql: Sql,
  res: Res,
  row: ContractRow,
  action: unknown,
  body: Record<string, unknown>
) => {
  switch (action) {
    case "update":
      return update(sql, res, row, body);
    case "send":
      return send(sql, res, row, body);
    case "countersign":
      return countersign(sql, res, row);
    case "reopen":
      if (row.status !== "sent") {
        return res
          .status(409)
          .json({ error: "Only an unsigned agreement can be reopened." });
      }
      return sql`
        UPDATE contracts SET status = 'draft', updated_at = now()
        WHERE id = ${row.id} AND status = 'sent'
      `.then(async () => res.status(200).json(await fresh(sql, row.id)));
    default:
      return res.status(400).json({ error: "Unknown action" });
  }
};

const read = async (
  sql: Sql,
  req: VercelRequest,
  res: Res,
  id: string,
  admin: boolean
) => {
  if (id === "for") {
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const slug = field(req.query.proposal, 200).toLowerCase();
    const proposal = slug ? await proposalBySlug(sql, slug) : null;
    const row = proposal
      ? await loadContractForProposal(sql, proposal.id)
      : null;
    return res.status(200).json(row ? rowToContract(row) : null);
  }
  const row = isUuid(id) ? await loadContract(sql, id) : null;
  if (!row || (row.status === "draft" && !admin)) {
    return res.status(404).json({ error: "Agreement not found" });
  }
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(rowToContract(row));
};

export default async function handler(req: VercelRequest, res: Res) {
  if (handleCors(req, res)) {
    return;
  }
  const raw =
    typeof req.query.id === "string" ? req.query.id : req.query.id?.[0];
  const id = (raw ?? "").trim().toLowerCase();
  const admin = Boolean(getBearerUser(req.headers.authorization));
  try {
    const sql = getSql();
    if (req.method === "GET") {
      return await read(sql, req, res, id, admin);
    }
    const body = parseJsonBody(req.body);
    if (req.method === "POST" && id === "new") {
      if (!admin) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return await create(sql, res, body);
    }
    const row = isUuid(id) ? await loadContract(sql, id) : null;
    if (!row) {
      return res.status(404).json({ error: "Agreement not found" });
    }
    if (req.method === "POST" && body.action === "sign") {
      return await sign(sql, req, res, row, body);
    }
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (req.method === "DELETE") {
      if (row.status === "signed" || row.status === "countersigned") {
        return res
          .status(409)
          .json({ error: "A signed agreement can't be deleted." });
      }
      await sql`DELETE FROM contracts WHERE id = ${row.id}`;
      return res.status(204).end();
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST, DELETE");
      return res.status(405).json({ error: "Method not allowed" });
    }
    return await adminAction(sql, res, row, body.action, body);
  } catch (e) {
    console.error("[contract]", e);
    return res
      .status(500)
      .json({ error: "Something went wrong with the agreement." });
  }
}
