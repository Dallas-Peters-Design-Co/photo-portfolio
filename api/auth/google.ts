import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { roleOf, signToken } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import {
  GoogleNotConfiguredError,
  verifyGoogleIdToken,
} from "../_lib/googleAuth.js";
import { verifyNeonToken } from "../_lib/neonAuth.js";
import { getDb, schema } from "../_lib/orm.js";
import { parseJsonBody } from "../_lib/parseBody.js";

/** The site's own token for someone this site knows, and who they are. */
const sendSession = (
  res: VercelResponse,
  user: { email: string; id: string; role: string }
) => {
  const role = roleOf(user.role);
  const token = signToken({ email: user.email, role, sub: user.id });
  return res
    .status(200)
    .json({ token, user: { email: user.email, id: user.id, role } });
};

/**
 * Signed in through Neon Auth (neonAuth.ts). Like Google above, it finds an
 * account and never makes one: a member exists once a board is shared with
 * their address, so a stranger's Google account reaches nothing.
 */
const neonSignIn = async (neonToken: string, res: VercelResponse) => {
  const identity = neonToken ? await verifyNeonToken(neonToken) : null;
  if (!identity) {
    return res
      .status(401)
      .json({ error: "Could not verify that sign-in. Try again." });
  }
  const [user] = await getDb()
    .select({
      email: schema.users.email,
      id: schema.users.id,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.email, identity.email))
    .limit(1);
  if (!user) {
    return res.status(403).json({
      error: `${identity.email} has no access here yet. Ask for a board to be shared with this address.`,
    });
  }
  return sendSession(res, user);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseJsonBody(req.body);
  if (typeof body.neonToken === "string") {
    return await neonSignIn(body.neonToken.trim(), res);
  }
  const credential =
    typeof body.credential === "string" ? body.credential.trim() : "";
  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }

  try {
    const identity = await verifyGoogleIdToken(credential);
    if (!identity) {
      return res
        .status(401)
        .json({ error: "Could not verify that Google account" });
    }

    // An unverified Google address proves nothing about mailbox ownership, so it
    // must not be usable to reach an admin account with the same address.
    if (!identity.emailVerified) {
      return res.status(403).json({
        error: "That Google account has no verified email address.",
      });
    }

    const db = getDb();
    const [user] = await db
      .select({
        email: schema.users.email,
        id: schema.users.id,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.email, identity.email))
      .limit(1);

    // Google sign-in authenticates existing admins; it never creates one.
    // Otherwise anyone with a Google account could mint themselves access.
    if (!user) {
      return res.status(403).json({
        error: "That Google account is not authorized for this site.",
      });
    }

    return sendSession(res, user);
  } catch (e) {
    console.error(e);
    if (e instanceof GoogleNotConfiguredError) {
      return res.status(503).json({
        error: "Google sign-in is not configured",
        hint: "Set GOOGLE_CLIENT_ID (server) and VITE_GOOGLE_CLIENT_ID (client) on the project.",
      });
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("JWT_SECRET")) {
      return res.status(500).json({ error: "JWT_SECRET is not configured." });
    }
    return res.status(500).json({ error: "Google sign-in failed" });
  }
}
