import type { getSql } from "./db.js";
import { notify } from "./notify.js";
import type { ProposalRow } from "./proposals.js";

/**
 * The client looking at a proposal: when they open it, and when they come
 * back to it.
 *
 * Recorded from the public read of a published proposal by anyone not
 * signed in to the admin, so previews never count. Repeat views are folded
 * into one per VIEW_WINDOW, so a client reloading the page, or the PDF
 * printer fetching it, is one visit rather than a stream of notifications;
 * the first view of all is the one that is also emailed.
 */

type Sql = ReturnType<typeof getSql>;

export const VIEW_WINDOW_MS = 6 * 60 * 60 * 1000;

/** The dedupe key for a view at `now`: one per proposal per window. */
export const viewKey = (proposalId: string, now: number): string =>
  `proposal-view:${proposalId}:${Math.floor(now / VIEW_WINDOW_MS)}`;

/** Who to name in a notice: the client on file, or a neutral stand-in. */
export const clientLabel = (row: Pick<ProposalRow, "client_name">): string =>
  row.client_name.trim() || "The client";

export const recordView = async (
  sql: Sql,
  row: ProposalRow,
  now: number = Date.now()
): Promise<void> => {
  let seenBefore = false;
  try {
    const prior = (await sql`
      SELECT 1 FROM activity
      WHERE subject_type = 'proposal' AND subject_id = ${row.id}
        AND kind = 'proposal.viewed'
      LIMIT 1
    `) as unknown[];
    seenBefore = prior.length > 0;
  } catch {
    // Not migrated yet: notify() below logs it and records nothing.
  }
  const who = clientLabel(row);
  await notify(sql, {
    body: seenBefore
      ? "They're reading it again."
      : "First time they've opened it.",
    dedupeKey: viewKey(row.id, now),
    email: !seenBefore,
    kind: "proposal.viewed",
    subjectId: row.id,
    subjectType: "proposal",
    title: seenBefore
      ? `${who} is looking at "${row.title}" again`
      : `${who} opened "${row.title}"`,
    url: `/admin/proposals/${row.slug}`,
  });
};
