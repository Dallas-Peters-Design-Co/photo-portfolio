import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sanitizeProposalDoc } from "../../../config/proposal.js";
import { getBearerUser } from "../../_lib/auth.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import {
  EmailNotConfiguredError,
  type SendEmailInput,
  sendEmail,
} from "../../_lib/email.js";
import { sanitizeText } from "../../_lib/httpUrl.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import {
  acceptanceNoticeEmail,
  type ProposalEmailInput,
  proposalCopyEmail,
} from "../../_lib/proposalEmail.js";
import {
  PROPOSAL_SELECT,
  type ProposalRow,
  rowToDto,
} from "../../_lib/proposals.js";
import { emailBrand, getSite } from "../../_lib/site.js";

/**
 * The client accepts a proposal.
 *
 * Public on purpose: the person accepting has no account here, only the link.
 * It is bounded by what the link already grants (reading a published
 * proposal) and records the three fields the signature line asks for, once.
 * A second press answers 409 with the acceptance already on file rather than
 * overwriting it.
 *
 * The owner is told by email when email is configured; when it is not, the
 * acceptance is still recorded and the response says so, since the signature
 * is the point and the email is a courtesy.
 */

const MAX_FIELD = 120;

const readFields = (body: Record<string, unknown>) => ({
  name:
    typeof body.name === "string"
      ? sanitizeText(body.name).slice(0, MAX_FIELD)
      : "",
  option:
    typeof body.option === "string"
      ? sanitizeText(body.option).slice(0, 40)
      : "",
  title:
    typeof body.title === "string"
      ? sanitizeText(body.title).slice(0, MAX_FIELD)
      : "",
});

/**
 * The client's signed copy and the owner's note, both through Resend. Each
 * is its own attempt, so a bad client address does not cost the owner the
 * notice. Returns what was sent; the acceptance is recorded either way.
 */
const sendEmails = async (
  input: ProposalEmailInput,
  clientEmail: string | null
): Promise<{ client: boolean; owner: boolean }> => {
  const site = getSite();
  const attempt = async (
    to: string | null,
    mail: Omit<SendEmailInput, "to"> | null
  ) => {
    if (!(to && mail)) {
      return false;
    }
    try {
      await sendEmail({ ...mail, to });
      return true;
    } catch (e) {
      if (!(e instanceof EmailNotConfiguredError)) {
        console.error(`[proposal email → ${to}]`, e);
      }
      return false;
    }
  };
  const [client, owner] = await Promise.all([
    attempt(clientEmail, clientEmail ? proposalCopyEmail(input) : null),
    attempt(site.defaultAdminEmail, acceptanceNoticeEmail(input)),
  ]);
  return { client, owner };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw =
    typeof req.query.slug === "string" ? req.query.slug : req.query.slug?.[0];
  const slug = raw?.trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Missing proposal address" });
  }

  const { name, title, option } = readFields(parseJsonBody(req.body));
  if (!name) {
    return res.status(400).json({ error: "Please type your name to accept." });
  }

  try {
    const sql = getSql();
    // A draft can be accepted only by a signed-in admin, which is how the
    // flow gets tested before the link goes out.
    const admin = getBearerUser(req.headers.authorization);
    const rows = (await sql`
      SELECT ${sql.unsafe(PROPOSAL_SELECT)}
      WHERE p.slug = ${slug} AND (p.status = 'published' OR ${Boolean(admin)})
      LIMIT 1
    `) as (ProposalRow & { accepted_at: string | null })[];
    const [row] = rows;
    if (!row) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    if (row.accepted_at) {
      return res
        .status(409)
        .json({ error: "This proposal has already been accepted." });
    }

    // The option must be one the proposal offers, or it is left blank.
    const doc = sanitizeProposalDoc(row.doc);
    const chosen = doc.packages.find((p) => p.id === option) ?? null;

    const updated = (await sql`
      UPDATE proposals SET
        accepted_at = now(),
        accepted_name = ${name},
        accepted_title = ${title || null},
        accepted_option = ${chosen?.id ?? null},
        updated_at = now()
      WHERE id = ${row.id} AND accepted_at IS NULL
      RETURNING id
    `) as { id: string }[];
    if (updated.length === 0) {
      return res
        .status(409)
        .json({ error: "This proposal has already been accepted." });
    }

    const after = (await sql`
      SELECT ${sql.unsafe(PROPOSAL_SELECT)}
      WHERE p.id = ${row.id}
    `) as ProposalRow[];
    const [fresh] = after;

    const site = getSite();
    const emailInput: ProposalEmailInput = {
      acceptedName: name,
      acceptedTitle: title,
      brand: emailBrand(site),
      chosen: chosen ? { name: chosen.name, price: chosen.price } : null,
      ownerName: site.ownerName,
      proposal: fresh ? rowToDto(fresh) : rowToDto(row),
      url: `https://${site.domain}/proposal/${slug}`,
    };
    const emailed = await sendEmails(emailInput, row.client_email ?? null);

    return res.status(200).json({ ...(fresh ? rowToDto(fresh) : {}), emailed });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("accepted_")) {
      return res.status(503).json({
        error:
          "Database schema is out of date. Run pnpm db:migrate against this deployment.",
      });
    }
    return res.status(500).json({ error: "Could not record the acceptance" });
  }
}
