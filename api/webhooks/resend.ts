import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db.js";
import { type ActivityKind, notify } from "../_lib/notify.js";
import { clientLabel } from "../_lib/proposalActivity.js";
import {
  headerValue,
  readRawBody,
  verifySvix,
} from "../_lib/webhookSignature.js";

/**
 * Resend's delivery events for the emails this site sends: delivered,
 * opened, clicked, bounced.
 *
 * Only proposal emails are acted on; they carry a `proposal` tag with the
 * proposal's id (see api/proposals/[slug]/send.ts), which is how an event
 * finds its proposal. Each kind is recorded once per email — an email opened
 * five times is one "opened" — keyed on Resend's email id.
 *
 * Set up in Resend: Webhooks → add https://<domain>/api/webhooks/resend with
 * the email.delivered, email.opened, email.clicked and email.bounced events,
 * and put its signing secret in RESEND_WEBHOOK_SECRET. Opens and clicks also
 * need open and click tracking turned on for the sending domain.
 */

export const config = { api: { bodyParser: false } };

const KINDS: Record<string, ActivityKind> = {
  "email.bounced": "proposal.bounced",
  "email.clicked": "proposal.clicked",
  "email.delivered": "proposal.delivered",
  "email.opened": "proposal.opened",
};

interface ResendEvent {
  data?: {
    email_id?: string;
    tags?: Record<string, string> | { name: string; value: string }[];
    to?: string[];
  };
  type?: string;
}

/** Resend has sent tags both as an object and as name/value pairs. */
export const tagValue = (
  tags: NonNullable<ResendEvent["data"]>["tags"],
  name: string
): string | null => {
  if (!tags) {
    return null;
  }
  if (Array.isArray(tags)) {
    return tags.find((t) => t.name === name)?.value ?? null;
  }
  return typeof tags[name] === "string" ? tags[name] : null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const describe = (
  kind: ActivityKind,
  who: string,
  title: string,
  to: string
): { body: string; title: string } => {
  switch (kind) {
    case "proposal.delivered":
      return { body: to, title: `"${title}" was delivered to ${who}` };
    case "proposal.opened":
      return {
        body: "They opened the email.",
        title: `${who} opened the email for "${title}"`,
      };
    case "proposal.clicked":
      return {
        body: "They clicked through to the proposal.",
        title: `${who} clicked the link to "${title}"`,
      };
    default:
      return {
        body: `The email to ${to} bounced. Check the address on the proposal.`,
        title: `The email for "${title}" bounced`,
      };
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ error: "Webhook secret is not configured" });
  }
  const body = await readRawBody(req);
  const ok = verifySvix(
    body,
    {
      id: headerValue(req.headers["svix-id"]),
      signature: headerValue(req.headers["svix-signature"]),
      timestamp: headerValue(req.headers["svix-timestamp"]),
    },
    secret
  );
  if (!ok) {
    return res.status(401).json({ error: "Bad signature" });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return res.status(400).json({ error: "Body is not JSON" });
  }
  const kind = event.type ? KINDS[event.type] : undefined;
  const proposalId = tagValue(event.data?.tags, "proposal");
  const emailId = event.data?.email_id;
  // Acknowledged but ignored: other kinds, other emails (password resets,
  // review links), or one this site did not tag.
  if (!(kind && proposalId && UUID.test(proposalId) && emailId)) {
    return res.status(200).json({ ignored: true });
  }

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, slug, title, client_name FROM proposals WHERE id = ${proposalId}
    `) as { client_name: string; id: string; slug: string; title: string }[];
    const [row] = rows;
    if (!row) {
      return res.status(200).json({ ignored: true });
    }
    const to = event.data?.to?.[0] ?? "";
    const text = describe(kind, clientLabel(row), row.title, to);
    await notify(sql, {
      ...text,
      dedupeKey: `${kind}:${emailId}`,
      kind,
      meta: { emailId, to },
      subjectId: row.id,
      subjectType: "proposal",
      url: `/admin/proposals/${row.slug}`,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[webhook resend]", e);
    // A 500 makes Resend retry, which is what an unreachable database wants.
    return res.status(500).json({ error: "Could not record the event" });
  }
}
