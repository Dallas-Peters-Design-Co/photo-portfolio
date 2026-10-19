import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  disablePush,
  enablePush,
  type PushState,
  pushState,
} from "../../lib/browserPush";
import {
  type ActivityItem,
  notificationsApi,
  timeAgo,
} from "../../services/activityService";
import "./NotificationBell.css";

/**
 * The bell in the admin bar: what happened since you last looked.
 *
 * Polls every minute and whenever the tab comes back into focus, so a client
 * opening a proposal shows up without a reload. Opening the list does not
 * mark anything read by itself; clicking an entry, or "Mark all read", does,
 * so a glance does not throw away the count.
 *
 * The browser-notification switch lives here because this is where the
 * notifications are: one place to see them, and one to have them pushed.
 */

const POLL_MS = 60_000;

const PUSH_LABELS: Record<PushState, string> = {
  denied: "Blocked in this browser's settings",
  off: "Turn on browser notifications",
  on: "Browser notifications are on",
  unconfigured: "Browser notifications need the VAPID keys in Vercel",
  unsupported: "This browser can't do notifications",
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await notificationsApi.latest();
      setItems(next.items);
      setUnread(next.unread);
    } catch {
      // A missed poll is retried in a minute; nothing to show for it.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void pushState()
      .then(setPush)
      .catch(() => setPush("unsupported"));
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = async (item: ActivityItem) => {
    setOpen(false);
    if (!item.read) {
      setItems((list) =>
        list.map((i) => (i.id === item.id ? { ...i, read: true } : i))
      );
      setUnread((n) => Math.max(0, n - 1));
      await notificationsApi.markRead([item.id]).catch(() => undefined);
    }
    if (item.url) {
      navigate(item.url);
    }
  };

  const markAll = async () => {
    setItems((list) => list.map((i) => ({ ...i, read: true })));
    setUnread(0);
    await notificationsApi.markRead("all").catch(() => undefined);
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      setPush(push === "on" ? await disablePush() : await enablePush());
    } catch {
      setPush("off");
    } finally {
      setPushBusy(false);
    }
  };

  const label = unread > 0 ? `${unread} unread notifications` : "Notifications";

  return (
    <div className="notification-bell" ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        className="notification-bell__button"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <Bell aria-hidden size={18} />
        {unread > 0 ? (
          <span aria-hidden className="notification-bell__count">
            {unread > 99 ? "99+" : String(unread)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          aria-label="Notifications"
          className="notification-bell__panel"
          role="dialog"
        >
          <div className="notification-bell__head">
            <span className="notification-bell__title">Activity</span>
            {unread > 0 ? (
              <button
                className="notification-bell__link"
                onClick={() => void markAll()}
                type="button"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="notification-bell__empty">
              Nothing yet. Sends, opens, signatures and payments show up here.
            </p>
          ) : (
            <ul className="notification-bell__list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={`notification-bell__item ${item.read ? "" : "notification-bell__item--unread"}`}
                    onClick={() => void openItem(item)}
                    type="button"
                  >
                    <span className="notification-bell__item-title">
                      {item.title}
                    </span>
                    {item.body ? (
                      <span className="notification-bell__item-body">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="notification-bell__item-time">
                      {timeAgo(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="notification-bell__foot">
            <span className="notification-bell__push-label">
              {push ? PUSH_LABELS[push] : "Checking…"}
            </span>
            {push === "off" || push === "on" ? (
              <button
                className="notification-bell__link"
                disabled={pushBusy}
                onClick={() => void togglePush()}
                type="button"
              >
                {push === "on" ? "Turn off" : "Turn on"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
