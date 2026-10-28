import { useEffect, useState } from "react";
import {
  type ActivityItem,
  notificationsApi,
  timeAgo,
} from "../../services/activityService";

/**
 * What has happened to this proposal, oldest first: sent, delivered, the
 * email opened, the page viewed, signed, invoiced, paid.
 *
 * Re-read when `refreshKey` changes (the editor bumps it after a send or an
 * invoice action) and when the tab regains focus, so a client's visit shows
 * up here without a reload.
 */

const DOTS: Record<string, string> = {
  "invoice.failed": "bg-red-400",
  "invoice.paid": "bg-emerald-400",
  "proposal.accepted": "bg-emerald-400",
  "proposal.bounced": "bg-red-400",
};

export function ProposalActivity({
  proposalId,
  refreshKey,
}: {
  proposalId: string;
  refreshKey: number;
}) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is the parent's signal to re-read; it is not read here
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { items: next } = await notificationsApi.timeline(proposalId);
        if (!cancelled) {
          setItems(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load");
        }
      }
    };
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [proposalId, refreshKey]);

  return (
    <section className="space-y-3 rounded-md border border-white/10 p-4">
      <h3 className="text-sm text-white/70 uppercase">Activity</h3>
      {error ? <p className="text-red-300 text-sm">{error}</p> : null}
      {items && items.length === 0 ? (
        <p className="text-sm text-white/55">
          Nothing yet. Once it's sent you'll see when it's delivered, opened,
          viewed and signed.
        </p>
      ) : null}
      {items && items.length > 0 ? (
        <ol className="space-y-2.5">
          {items.map((item) => (
            <li className="flex gap-3 text-sm" key={item.id}>
              <span
                aria-hidden
                className={`mt-1.5 size-2 shrink-0 rounded-full ${DOTS[item.kind] ?? "bg-white/40"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-white/90">{item.title}</span>
                {item.body ? (
                  <span className="block text-white/55">{item.body}</span>
                ) : null}
              </span>
              <time
                className="shrink-0 text-sm text-white/45 tabular-nums"
                dateTime={item.createdAt}
                title={new Date(item.createdAt).toLocaleString()}
              >
                {timeAgo(item.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
