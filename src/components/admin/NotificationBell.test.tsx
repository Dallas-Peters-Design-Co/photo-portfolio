import "../../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityItem } from "../../services/activityService";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The bell, from the owner's chair: the unread count is right, opening the
 * list shows what happened, and clicking an entry marks it read and goes to
 * the proposal.
 */

const ITEMS: ActivityItem[] = [
  {
    body: "Launch ($3,000). A $1,500 invoice is drafted and ready to send.",
    createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    id: "a1",
    kind: "proposal.accepted",
    read: false,
    subjectId: "p1",
    title: 'Vin Gokhale signed "Pretext launch"',
    url: "/admin/proposals/pretext",
  },
  {
    body: "First time they've opened it.",
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    id: "a2",
    kind: "proposal.viewed",
    read: true,
    subjectId: "p1",
    title: 'Vin Gokhale opened "Pretext launch"',
    url: "/admin/proposals/pretext",
  },
];

let feed = { items: ITEMS, unread: 1 };
const markRead = vi.fn((_read: "all" | string[]) => Promise.resolve());
vi.mock("../../services/activityService", async (original) => ({
  ...(await original<typeof import("../../services/activityService")>()),
  notificationsApi: {
    latest: () => Promise.resolve(feed),
    markRead,
    timeline: () => Promise.resolve({ items: [] }),
  },
}));
vi.mock("../../lib/browserPush", () => ({
  disablePush: () => Promise.resolve("off"),
  enablePush: () => Promise.resolve("on"),
  pushState: () => Promise.resolve("off"),
}));

const { NotificationBell } = await import("./NotificationBell");

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let path = "";

function Where() {
  path = useLocation().pathname;
  return null;
}

const flush = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const render = async () => {
  host = document.createElement("div");
  host.style.cssText =
    "display:flex;justify-content:flex-end;width:600px;height:560px;padding:16px;background:#151516;color:#fff;--background:#151516;--foreground:#fff;--color-accent:#97990e";
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <MemoryRouter initialEntries={["/admin"]}>
        <NotificationBell />
        <Routes>
          <Route element={<Where />} path="*" />
        </Routes>
      </MemoryRouter>
    );
  });
  await flush();
};

beforeEach(async () => {
  markRead.mockClear();
  feed = { items: ITEMS, unread: 1 };
  await render();
});

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
  window.photosDesktop = undefined;
});

const bell = () =>
  host?.querySelector<HTMLButtonElement>(".notification-bell__button") ?? null;

describe("NotificationBell", () => {
  it("shows the unread count on the bell", () => {
    expect(bell()?.getAttribute("aria-label")).toBe("1 unread notifications");
    expect(host?.querySelector(".notification-bell__count")?.textContent).toBe(
      "1"
    );
  });

  it("lists what happened, unread first in weight", async () => {
    await act(() => bell()?.click());
    await flush();
    const rows = [
      ...(host?.querySelectorAll(".notification-bell__item") ?? []),
    ];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.classList.contains("notification-bell__item--unread")).toBe(
      true
    );
    expect(rows[0]?.textContent).toContain("signed");
    expect(host?.textContent).toContain("Turn on browser notifications");
  });

  it("marks an entry read and opens its proposal", async () => {
    await act(() => bell()?.click());
    await flush();
    const first = host?.querySelector<HTMLButtonElement>(
      ".notification-bell__item"
    );
    await act(() => first?.click());
    await flush();
    expect(markRead).toHaveBeenCalledWith(["a1"]);
    expect(path).toBe("/admin/proposals/pretext");
    expect(host?.querySelector(".notification-bell__count")).toBeNull();
  });
});

describe("NotificationBell in the desktop app", () => {
  const notify = vi.fn((_n: { title: string }) => Promise.resolve());
  const setBadgeCount = vi.fn((_n: number) => Promise.resolve());
  let clicked: ((url: string) => void) | null = null;

  beforeEach(async () => {
    await act(() => root?.unmount());
    host?.remove();
    notify.mockClear();
    setBadgeCount.mockClear();
    window.photosDesktop = {
      forgetGoogleToken: () => Promise.resolve(),
      notify,
      onNotificationClick: (handler) => {
        clicked = handler;
        return () => {
          clicked = null;
        };
      },
      requestGoogleToken: () =>
        Promise.resolve({ access_token: "", expires_in: 0 }),
      setBadgeCount,
    };
    await render();
  });

  it("badges the dock, but doesn't replay what was there at launch", () => {
    expect(notify).not.toHaveBeenCalled();
    expect(setBadgeCount).toHaveBeenLastCalledWith(1);
  });

  it("notifies once for activity that arrives later, and opens it on click", async () => {
    const paid: ActivityItem = {
      body: "$1,500 from Vin Gokhale.",
      createdAt: new Date().toISOString(),
      id: "a3",
      kind: "invoice.paid",
      read: false,
      subjectId: "p1",
      title: "Invoice paid",
      url: "/admin/proposals/pretext",
    };
    feed = { items: [paid, ...ITEMS], unread: 2 };
    await act(() => window.dispatchEvent(new Event("focus")));
    await flush();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      body: "$1,500 from Vin Gokhale.",
      title: "Invoice paid",
      url: "/admin/proposals/pretext",
    });
    expect(setBadgeCount).toHaveBeenLastCalledWith(2);

    await act(() => window.dispatchEvent(new Event("focus")));
    await flush();
    expect(notify).toHaveBeenCalledTimes(1);

    await act(() => clicked?.("/admin/proposals/pretext"));
    expect(path).toBe("/admin/proposals/pretext");
  });

  it("says notifications come from the app, with no browser toggle", async () => {
    await act(() => bell()?.click());
    await flush();
    expect(host?.textContent).toContain("Desktop notifications are on");
    expect(host?.textContent).not.toContain("Turn on");
  });
});
