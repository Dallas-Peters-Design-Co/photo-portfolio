import { timingSafeEqual } from "node:crypto";

import { type AuthFn, localDev, vercelOidc, withAuthChallenges } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// The UX Audit web app calls this agent server-to-server with a shared secret:
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
});
