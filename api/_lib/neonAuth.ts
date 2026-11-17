import { createRemoteJWKSet, jwtVerify } from "jose";
import { getSql } from "./db.js";

/**
 * Signing in through Neon Auth (managed Better Auth): Google, on the
 * dallas-images site, where it is set up.
 *
 * The browser signs in with Neon, asks it for a short-lived token, and hands
 * that here once; google.ts then gives it the site's own token, so every
 * endpoint keeps reading one kind. The token is checked against Neon's
 * public keys, then the person is read from Neon Auth's own user table (in
 * this database): only a verified address that is not banned counts, because
 * Neon Auth's email sign-up does not verify addresses, and a member is found
 * by address.
 */

const TRAILING_SLASHES = /\/+$/;

let keys: ReturnType<typeof createRemoteJWKSet> | null = null;

const baseUrl = (): string =>
  (process.env.NEON_AUTH_BASE_URL ?? process.env.VITE_NEON_AUTH_URL ?? "")
    .trim()
    .replace(TRAILING_SLASHES, "");

export const isNeonAuthConfigured = (): boolean => baseUrl() !== "";

const jwks = () => {
  keys ??= createRemoteJWKSet(new URL(`${baseUrl()}/.well-known/jwks.json`));
  return keys;
};

interface NeonUserRow {
  banned: boolean | null;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** The verified address behind a Neon Auth token, or null. */
export const verifyNeonToken = async (
  token: string
): Promise<{ email: string; name: string | null } | null> => {
  if (!isNeonAuthConfigured()) {
    return null;
  }
  let sub: string | undefined;
  try {
    ({
      payload: { sub },
    } = await jwtVerify(token, jwks()));
  } catch {
    return null;
  }
  if (!sub) {
    return null;
  }
  const rows = (await getSql()`
    SELECT email, "emailVerified", banned, name
    FROM neon_auth."user"
    WHERE id::text = ${sub}
    LIMIT 1
  `) as NeonUserRow[];
  const [row] = rows;
  if (!row?.emailVerified || row.banned) {
    return null;
  }
  return { email: row.email.trim().toLowerCase(), name: row.name };
};
