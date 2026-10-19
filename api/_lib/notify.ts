import type { getSql } from "./db.js";
import { EmailNotConfiguredError, sendEmail } from "./email.js";
import { button, emailFrame, escapeHtml, P } from "./emailLayout.js";
import { pushToAll } from "./push.js";
import { emailBrand, getSite } from "./site.js";

/**
 * Something happened that the owner should know about.
 *
 * One call records it in `activity` (the proposal's timeline and the admin's
 * notification bell), then tells the owner by browser push and, for the
 * events worth an email, by email. Recording is the part that matters: the
 * push and the email are each best-effort and never fail the request that
 * caused them.
 *
 * `dedupeKey` makes it safe to call twice for the same upstream event — a
 * webhook redelivered, two tabs opening the page at once. The second call
 * records nothing and tells no one.
 */

type Sql = ReturnType<typeof getSql>;

export type ActivityKind =
  | "proposal.sent"
  | "proposal.delivered"
  | "proposal.opened"
  | "proposal.clicked"
  | "proposal.bounced"
  | "proposal.viewed"
  | "proposal.accepted"
  | "invoice.drafted"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.failed"
  | "invoice.voided";

export interface Notice {
  body?: string;
  dedupeKey?: string;
  /**
   * Email the owner too. Defaults by kind (see EMAILED): the moments that
   * change what happens next, not every delivery receipt.
   */
  email?: boolean;
  kind: ActivityKind;
  meta?: Record<string, unknown>;
  subjectId?: string | null;
  subjectType: "proposal" | "invoice";
  title: string;
  /** An admin path, e.g. /admin/proposals/some-slug. */
  url?: string;
}

/** Kinds that also go to the owner's inbox unless the caller says otherwise. */
export const EMAILED: ReadonlySet<ActivityKind> = new Set([
  "proposal.viewed",
  "proposal.bounced",
  "invoice.paid",
  "invoice.failed",
]);

/** The subject line and kicker for each kind's email. */
const KICKERS: Partial<Record<ActivityKind, string>> = {
  "invoice.failed": "Payment failed",
  "invoice.paid": "Paid",
  "proposal.bounced": "Email bounced",
  "proposal.viewed": "Opened",
};

export const noticeEmail = (notice: Notice) => {
  const site = getSite();
  const link = notice.url ? `https://${site.domain}${notice.url}` : null;
  const lines = [notice.title, notice.body ?? ""].filter((l) => l !== "");
  const html = emailFrame({
    brand: emailBrand(site),
    content: `${lines
      .slice(1)
      .map((l) => `<p ${P}>${escapeHtml(l)}</p>`)
      .join("")}${link ? button(link, "Open in the admin") : ""}`,
    kicker: KICKERS[notice.kind] ?? "Activity",
    preheader: notice.body ?? notice.title,
    title: notice.title,
  });
  return {
    html,
    subject: notice.title,
    text: [...lines, link ?? ""].filter(Boolean).join("\n\n"),
  };
};

/**
 * Records the notice and fans it out. Returns the new row's id, or null when
 * it was a duplicate or could not be recorded (an un-migrated database is
 * logged and skipped rather than failing the caller).
 */
export const notify = async (
  sql: Sql,
  notice: Notice
): Promise<string | null> => {
  let id: string | null = null;
  try {
    const rows = (await sql`
      INSERT INTO activity
        (kind, subject_type, subject_id, title, body, url, meta, dedupe_key)
      VALUES (
        ${notice.kind}, ${notice.subjectType}, ${notice.subjectId ?? null},
        ${notice.title}, ${notice.body ?? ""}, ${notice.url ?? null},
        ${JSON.stringify(notice.meta ?? {})}::jsonb, ${notice.dedupeKey ?? null}
      )
      ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING id
    `) as { id: string }[];
    id = rows[0]?.id ?? null;
  } catch (e) {
    console.error("[notify] could not record activity", e);
    return null;
  }
  if (!id) {
    return null;
  }

  const wantsEmail = notice.email ?? EMAILED.has(notice.kind);
  await Promise.allSettled([
    pushToAll(sql, {
      body: notice.body ?? "",
      icon: `/sites/${getSite().key}/icon192.png`,
      tag: notice.subjectId ? `${notice.subjectType}-${notice.subjectId}` : id,
      title: notice.title,
      url: notice.url ?? "/admin",
    }),
    wantsEmail
      ? sendEmail({ ...noticeEmail(notice), to: getSite().defaultAdminEmail })
          .then(() => true)
          .catch((e: unknown) => {
            if (!(e instanceof EmailNotConfiguredError)) {
              console.error("[notify] email failed", e);
            }
            return false;
          })
      : Promise.resolve(false),
  ]);
  return id;
};
