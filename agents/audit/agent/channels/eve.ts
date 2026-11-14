import { timingSafeEqual } from "node:crypto";

import { type AuthFn, localDev, vercelOidc, withAuthChallenges } from "eve/channels/auth";
import { defaultEveAuth, eveChannel } from "eve/channels/eve";

import { LOGIN_URL_ATTRIBUTE, parseLoginUrl } from "../lib/login-target";

// The site (Reviews) calls this agent server-to-server with a shared secret:
//   Authorization: Bearer $EVE_API_TOKEN
const apiToken: AuthFn<Request> = withAuthChallenges(
  (request) => {
    const expected = process.env.EVE_API_TOKEN;
    const header = request.headers.get("authorization") ?? "";
    if (!expected || !header.startsWith("Bearer ")) return null;
    const given = Buffer.from(header.slice("Bearer ".length));
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
    return {
      attributes: {},
      authenticator: "api-token",
      principalId: "ux-audit-app",
      principalType: "service" as const,
    };
  },
  [{ scheme: "Bearer" }],
);

export default eveChannel({
  auth: [
    apiToken,
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev`; ignored in production.
    localDev(),
  ],
  /*
   * The caller names the app's login page in clientContext: { loginUrl }.
   * It is stored as an attribute on the session's auth here, before the model
   * runs, and dropped from what the model sees. log_in then types the stored
   * credentials only on that origin, so a page can't talk the model into
   * logging in somewhere else. LOGIN_URL on the server is a fallback.
   */
  onMessage(ctx) {
    const auth = defaultEveAuth(ctx);
    const sent = ctx.eve.clientContext;
    const loginUrl =
      sent && typeof sent === "object" && !Array.isArray(sent)
        ? (sent as { loginUrl?: unknown }).loginUrl
        : undefined;
    const target = parseLoginUrl(loginUrl);
    return {
      auth:
        target && auth
          ? { ...auth, attributes: { ...auth.attributes, [LOGIN_URL_ATTRIBUTE]: target.url } }
          : auth,
      clientContext: [],
    };
  },
});
