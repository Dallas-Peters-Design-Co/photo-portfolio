# Audit agent (eve)

The eve agent behind **Reviews → Capture behind login**. It signs in to a client
app with a test account, finds the key pages, and screenshots each at desktop and
phone width. The site copies the pictures into the review, then runs its own UX
audit on them (`api/reviews/audit.ts`).

It is its own package (npm, not part of the pnpm install) and deploys as its own
Vercel project, `audit-agent`. It deploys from Git: pushing `main` builds it
with Root Directory `agents/audit` (that setting must stay; empty, a push builds
the photo site onto the agent's address). A push that does not touch
`agents/audit` skips the build. `npx eve deploy` does not work with this
setting. Production: https://audit-agent-vert.vercel.app

## How it connects to the site

- `api/reviews/explore.ts` starts a capture and polls it (`api/_lib/reviewAgent.ts`).
- Screenshots go to the **private** Blob store `audit-agent-screens`. It is
  connected to `dallas-images` with the env prefix `REVIEW_BLOB`; this project
  has the same token set as `REVIEW_BLOB_READ_WRITE_TOKEN`, and the tool reads
  only that name. The site
  checks each picture is a PNG in that store and keeps its plain address; it
  hands out short-lived signed links only to the admin and to visitors who hold
  the review's pass (`api/_lib/reviewImages.ts`).
- Doppler holds the login account and API keys. Its `BLOB_READ_WRITE_TOKEN`
  is not used.

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
