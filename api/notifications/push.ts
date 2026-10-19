import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { pushKeys } from "../_lib/push.js";

/**
 * Turning browser notifications on and off for this browser. Admin only.
 *
 * GET hands the browser the public VAPID key it subscribes with (or says
 * push is not configured); POST stores the subscription it got back; DELETE
 * forgets it. The subscription's endpoint is its identity, so subscribing
 * again from the same browser replaces rather than duplicates.
 */

const MAX = 2048;

const str = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, MAX) : "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  const user = getBearerUser(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const keys = pushKeys();
    return res
      .status(200)
      .json({ configured: Boolean(keys), publicKey: keys?.publicKey ?? null });
  }

  const body = parseJsonBody(req.body);
  const subscription = (body.subscription ?? body) as {
    endpoint?: unknown;
    keys?: { auth?: unknown; p256dh?: unknown };
  };
  const endpoint = str(subscription.endpoint);
  if (!endpoint.startsWith("https://")) {
    return res.status(400).json({ error: "Missing subscription endpoint" });
  }

  try {
    const sql = getSql();
    if (req.method === "POST") {
      const p256dh = str(subscription.keys?.p256dh);
      const auth = str(subscription.keys?.auth);
      if (!(p256dh && auth)) {
        return res.status(400).json({ error: "Missing subscription keys" });
      }
      await sql`
        INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id)
        VALUES (${endpoint}, ${p256dh}, ${auth}, ${user.userId})
        ON CONFLICT (endpoint) DO UPDATE
          SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
              user_id = EXCLUDED.user_id
      `;
      return res.status(204).end();
    }
    if (req.method === "DELETE") {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
      return res.status(204).end();
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[push subscription]", e);
    return res.status(500).json({ error: "Could not save the subscription" });
  }
}
