import { apiBase, jsonHeaders, readPageError } from "./portfolioService";

/**
 * Notifications, browser push and invoices: the admin's client for what
 * happens after a proposal goes out. Its own module, like proposalService,
 * because the shared service file only shrinks.
 */

export interface ActivityItem {
  body: string;
  createdAt: string;
  id: string;
  kind: string;
  read: boolean;
  subjectId: string | null;
  title: string;
  /** An admin path to open, e.g. /admin/proposals/some-slug. */
  url: string | null;
}

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible";

export interface Invoice {
  amountCents: number;
  createdAt: string;
  currency: string;
  customerEmail: string;
  customerName: string;
  description: string;
  dueDays: number;
  hostedUrl: string | null;
  id: string;
  number: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
  proposalId: string | null;
  sentAt: string | null;
  status: InvoiceStatus;
}

export interface InvoiceInput {
  amountCents?: number;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  dueDays?: number;
}

const call = async <T>(
  path: string,
  fallback: string,
  init: RequestInit = {}
): Promise<T> => {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: jsonHeaders(),
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, fallback));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
};

export const notificationsApi = {
  latest: () =>
    call<{ items: ActivityItem[]; unread: number }>(
      "/api/notifications",
      "Could not load notifications"
    ),
  markRead: (read: "all" | string[]) =>
    call<void>("/api/notifications", "Could not mark as read", {
      body: JSON.stringify({ read }),
      method: "POST",
    }),
  timeline: (proposalId: string) =>
    call<{ items: ActivityItem[] }>(
      `/api/notifications?proposal=${encodeURIComponent(proposalId)}`,
      "Could not load the activity"
    ),
};

export const pushApi = {
  config: () =>
    call<{ configured: boolean; publicKey: string | null }>(
      "/api/notifications/push",
      "Could not check notifications"
    ),
  forget: (endpoint: string) =>
    call<void>("/api/notifications/push", "Could not turn off notifications", {
      body: JSON.stringify({ endpoint }),
      method: "DELETE",
    }),
  save: (subscription: PushSubscriptionJSON) =>
    call<void>("/api/notifications/push", "Could not turn on notifications", {
      body: JSON.stringify({ subscription }),
      method: "POST",
    }),
};

const forProposal = (slug: string) =>
  `/api/proposals/${encodeURIComponent(slug)}/invoices`;
const one = (id: string) => `/api/invoices/${encodeURIComponent(id)}`;

export const invoicesApi = {
  create: (slug: string, input: InvoiceInput) =>
    call<Invoice>(forProposal(slug), "Could not draft the invoice", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  list: (slug: string) =>
    call<{ invoices: Invoice[]; stripe: boolean }>(
      forProposal(slug),
      "Could not load invoices"
    ),
  remove: (id: string) =>
    call<void>(one(id), "Could not delete the draft", { method: "DELETE" }),
  send: (id: string) =>
    call<Invoice>(one(id), "Could not send the invoice", {
      body: JSON.stringify({ action: "send" }),
      method: "POST",
    }),
  update: (id: string, input: InvoiceInput) =>
    call<Invoice>(one(id), "Could not save the invoice", {
      body: JSON.stringify(input),
      method: "PATCH",
    }),
  void: (id: string) =>
    call<Invoice>(one(id), "Could not void the invoice", {
      body: JSON.stringify({ action: "void" }),
      method: "POST",
    }),
};

const MONEY = /(\d[\d,]*(?:\.\d{1,2})?)/;

/** The first figure in a free-text price, in cents: "$3,000 / month" → 300000. */
export const priceToCents = (price: string): number | null => {
  const figure = MONEY.exec(price)?.[1];
  const value = figure ? Number(figure.replaceAll(",", "")) : 0;
  return value > 0 ? Math.round(value * 100) : null;
};

export const formatMoney = (cents: number, currency = "usd"): string =>
  new Intl.NumberFormat("en-US", {
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(cents / 100);

/** "3m ago", "2h ago", "Oct 18": short enough for a list row. */
export const timeAgo = (iso: string, now: number = Date.now()): string => {
  const seconds = Math.max(
    0,
    Math.round((now - new Date(iso).getTime()) / 1000)
  );
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
};
