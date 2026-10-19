import webpush from "web-push";
import type { getSql } from "./db.js";

/**
 * Browser push to the owner's devices, through the standard Web Push protocol.
 *
 * The keys are a VAPID pair (`npx web-push generate-vapid-keys`): the public
 * one is handed to the browser when it subscribes, the private one signs each
 * push. Without them push is simply off; nothing else depends on it.
 */

type Sql = ReturnType<typeof getSql>;

export interface PushPayload {
  body: string;
  /** The site's app icon; the worker is shared by every site, so it is sent. */
  icon?: string;
  /** Collapses repeats: a newer notice with the same tag replaces the older. */
  tag?: string;
  title: string;
  /** Where a click on the notification goes; an admin path. */
  url: string;
}

interface PushKeys {
  privateKey: string;
  publicKey: string;
  subject: string;
}

export const pushKeys = (): PushKeys | null => {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!(publicKey && privateKey)) {
    return null;
  }
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:notifications@example.com";
  return { privateKey, publicKey, subject };
};

interface SubscriptionRow {
  auth: string;
  endpoint: string;
  p256dh: string;
}

/** Status codes meaning the subscription is gone for good: forget it. */
const GONE = new Set([404, 410]);

/**
 * Sends one notice to every subscribed browser. Never throws: a push that
 * fails is a notification missed, not a request failed. Subscriptions the
 * push service reports as expired are deleted.
 */
export const pushToAll = async (
  sql: Sql,
  payload: PushPayload
): Promise<number> => {
  const keys = pushKeys();
  if (!keys) {
    return 0;
  }
  let rows: SubscriptionRow[] = [];
  try {
    rows = (await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions
    `) as SubscriptionRow[];
  } catch (e) {
    console.error("[push] could not read subscriptions", e);
    return 0;
  }
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { auth: row.auth, p256dh: row.p256dh },
        },
        body,
        {
          TTL: 60 * 60 * 24,
          vapidDetails: keys,
        }
      )
    )
  );
  let sent = 0;
  const gone: string[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      sent += 1;
      continue;
    }
    const reason = result.reason as { statusCode?: number } | undefined;
    const status = reason?.statusCode;
    const endpoint = rows[i]?.endpoint;
    if (status && GONE.has(status) && endpoint) {
      gone.push(endpoint);
    } else {
      console.error("[push] send failed", status ?? result.reason);
    }
  }
  if (gone.length > 0) {
    await sql`
      DELETE FROM push_subscriptions WHERE endpoint = ANY(${gone})
    `.catch((e: unknown) => console.error("[push] cleanup failed", e));
  }
  return sent;
};
