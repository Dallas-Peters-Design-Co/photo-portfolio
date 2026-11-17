import { createAuthClient } from "@neon/auth";
import { BetterAuthVanillaAdapter } from "@neon/auth/vanilla/adapters";

/**
 * Signing in through Neon Auth (managed Better Auth) with Google: how a
 * person a board was shared with gets in (api/_lib/neonAuth.ts).
 *
 * Neon holds the Google sign-in; this asks it for a short-lived token once,
 * and api/auth/google.ts swaps that for the site's own token. Loaded only
 * when VITE_NEON_AUTH_URL is set, which it is on dallas-images.
 */

const AUTH_URL = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

export const isNeonAuthEnabled = (): boolean => Boolean(AUTH_URL);

const makeClient = (url: string) =>
  createAuthClient(url, { adapter: BetterAuthVanillaAdapter() });

interface WithToken {
  token: () => Promise<{ data?: { token?: string } | null }>;
}

let client: ReturnType<typeof makeClient> | null = null;

const authClient = () => {
  if (!AUTH_URL) {
    throw new Error("Neon Auth is not set up on this site");
  }
  client ??= makeClient(AUTH_URL);
  return client;
};

/** Off to Google; comes back to this page signed in with Neon. */
export const startGoogleSignIn = async (): Promise<void> => {
  const { error } = await authClient().signIn.social({
    callbackURL: window.location.href,
    provider: "google",
  });
  if (error) {
    throw new Error(error.message || "Couldn't start Google sign-in");
  }
};

/** Neon's token for the person signed in with it, or null for nobody. */
export const neonTokenIfSignedIn = async (): Promise<string | null> => {
  if (!AUTH_URL) {
    return null;
  }
  const { data: session } = await authClient().getSession();
  if (!(session && "user" in session && session.user)) {
    return null;
  }
  // The JWT plugin is always on in Neon's client and adds token() at run
  // time; its typings drop it, so it is named here.
  const { data } = await (authClient() as unknown as WithToken).token();
  return data?.token ?? null;
};

/** Ends the Neon session too, so signing out here signs out there. */
export const neonSignOut = async (): Promise<void> => {
  if (AUTH_URL) {
    await authClient()
      .signOut()
      .catch(() => undefined);
  }
};
