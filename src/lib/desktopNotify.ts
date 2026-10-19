import type { ActivityItem } from "../services/activityService";

/**
 * Activity notifications inside the desktop app.
 *
 * Web Push has no push service behind it in Electron, so the browser toggle
 * can never work there. The bell already polls for activity; this turns what
 * a poll finds that the last one didn't into native notifications, and keeps
 * the dock badge on the unread count.
 *
 * Null outside the app, and in builds of the app from before the shell
 * exposed `notify`, so the website behaves exactly as before.
 */

/** More than this at once collapses into one summary notification. */
const MAX_AT_ONCE = 3;

type Notifier = Required<
  Pick<PhotosDesktop, "notify" | "onNotificationClick" | "setBadgeCount">
>;

export function desktopNotifier(): Notifier | null {
  const shell =
    typeof window === "undefined" ? undefined : window.photosDesktop;
  if (!(shell?.notify && shell.onNotificationClick && shell.setBadgeCount)) {
    return null;
  }
  return {
    notify: shell.notify,
    onNotificationClick: shell.onNotificationClick,
    setBadgeCount: shell.setBadgeCount,
  };
}

/**
 * The unread items in `items` that `seen` doesn't have. The first poll after
 * launch passes `seen` as null and gets nothing: what was there before the
 * app opened is on the badge, not worth a burst of notifications.
 */
export function freshItems(
  items: ActivityItem[],
  seen: ReadonlySet<string> | null
): ActivityItem[] {
  if (!seen) {
    return [];
  }
  return items.filter((item) => !(item.read || seen.has(item.id)));
}

/** Shows `fresh` as native notifications, summarising a large batch. */
export function announce(notifier: Notifier, fresh: ActivityItem[]): void {
  if (fresh.length === 0) {
    return;
  }
  const quiet = () => undefined;
  if (fresh.length > MAX_AT_ONCE) {
    notifier
      .notify({
        body: fresh
          .slice(0, MAX_AT_ONCE)
          .map((item) => item.title)
          .join("\n"),
        title: `${fresh.length} new updates`,
        url: "/admin",
      })
      .catch(quiet);
    return;
  }
  for (const item of fresh) {
    notifier
      .notify({
        body: item.body || undefined,
        title: item.title,
        url: item.url ?? undefined,
      })
      .catch(quiet);
  }
}
