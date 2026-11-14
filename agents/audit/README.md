# Audit agent (eve)

The eve agent behind **Reviews → Capture behind login**. It signs in to a client
app with a test account, finds the key pages, and screenshots each at desktop and
phone width. The site copies the pictures into the review, then runs its own UX
audit on them (`api/reviews/audit.ts`).

It is its own package (npm, not part of the pnpm install) and deploys as its own
Vercel project, `audit-agent`, with Root Directory `agents/audit`.

## How it connects to the site

- `api/reviews/explore.ts` starts a capture and polls it (`api/_lib/reviewAgent.ts`).
- The agent never gets write access to the site. It stores screenshots in its own
  **private** Blob store and returns one-hour, read-only links to single files.
  The site checks each link, downloads the PNG, and stores it with its own key.

## Files

- `agent/agent.ts` — model (Claude via `ANTHROPIC_API_KEY`) and a $5 per-session cost cap
- `agent/instructions/` — role, capture steps, look-don't-change rules, UX framework
- `agent/tools/log_in.ts` — types `LOGIN_USER` / `LOGIN_PASS`; the model never sees them
- `agent/tools/capture_screen.ts` — full-page screenshot → private Blob → read-only link
- `agent/extensions/browser/` — Chromium tools (upload tool disabled)
- `agent/sandbox.ts` — Docker locally, Vercel Sandbox on Vercel
- `agent/channels/eve.ts` — API auth (`EVE_API_TOKEN` bearer)

## Settings (Vercel project `audit-agent`, synced from Doppler `ux-audits/prd`)

See `.env.example`. The site needs `EVE_AGENT_URL` and the same `EVE_API_TOKEN`.

## Run locally

Needs Node 24+ and Docker running.

```bash
cd agents/audit
npm ci
vercel env pull .env.local          # Blob store + OIDC
doppler run --project ux-audits --config prd -- npm run dev   # http://127.0.0.1:2000
```
