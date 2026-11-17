# Photo portfolio and studio

One codebase that runs three photography sites, and a private studio behind
them: a node-based design canvas, brand kits, client proposals, contracts,
invoices, UX design reviews with an AI audit, and an MCP server so Claude can
read and act on all of it.

| Site key        | Domain              | What it is                          |
| --------------- | ------------------- | ----------------------------------- |
| `addison`       | addisonsphotos.com  | Photo portfolio                     |
| `cyan`          | cyansphotos.com     | Photo portfolio                     |
| `dallas-images` | dallaspeters.com    | Portfolio plus the full studio      |

Each site is its own Vercel project with its own Neon Postgres database.
Nothing is shared between sites at runtime.

> **Read [`AGENTS.md`](AGENTS.md) before you change anything.** It lists the
> mistakes that have broken production here. The most important one:
> **local development uses the live database.** See [Databases](#databases).

---

## Contents

- [Quick start](#quick-start)
- [Stack](#stack)
- [Repository map](#repository-map)
- [Capabilities](#capabilities)
  - [Public sites](#public-sites)
  - [Admin](#admin)
  - [The canvas (boards)](#the-canvas-boards)
  - [Design reviews and the UX audit](#design-reviews-and-the-ux-audit)
  - [Proposals, contracts and invoices](#proposals-contracts-and-invoices)
  - [Brand kits](#brand-kits)
- [MCP server](#mcp-server)
- [The audit agent (`agents/audit`)](#the-audit-agent-agentsaudit)
- [Side tools](#side-tools)
- [API](#api)
- [Databases](#databases)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Testing](#testing)
- [Lint and quality gates](#lint-and-quality-gates)
- [Development patterns](#development-patterns)
- [Deploying](#deploying)
- [Further reading](#further-reading)

---

## Quick start

Requirements: Node 22+, pnpm, and a Hugeicons Pro registry token
(`HUGEICONS_TOKEN`, kept in Doppler project `photo-portfolio`; see `.npmrc`).

```bash
pnpm install
pnpm vercel:env:pull          # writes .env.development.local from Vercel
pnpm db:info                  # which database am I pointed at? (it is live)
pnpm dev                      # dallas-images on http://localhost:3006
```

Other sites: `pnpm dev:addison`, `pnpm dev:cyan`.

`pnpm dev` runs `scripts/dev-stack.mjs`, which:

1. Frees ports 3006 (`PORT`), 3007 (`API_PORT`), 4123 (vector bridge) and
   5173–5175.
2. Prints the database host it is about to use.
3. Copies `VITE_SITE` into `SITE`. The browser bundle reads `VITE_SITE`; the
   serverless functions read `SITE`.
4. Starts Vite on `PORT`, and `scripts/api-dev.ts` on `API_PORT`. That file
   imitates Vercel's file routing and loads each handler once, so an `/api`
   call skips the ~1 s bundling that `vercel dev` does. Vite proxies `/api`
   to it.
5. Starts the vector-editor bridge (`scripts/affinity-bridge.mjs`).

Use `pnpm dev:vercel` (or `DEV_STACK=vercel`) to run real `vercel dev`
instead.

---

## Stack

| Layer      | Choice                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| Front end  | Vite, React 19, react-router-dom 7, Tailwind CSS v4                    |
| UI kit     | shadcn (`base-nova` style) on Base UI; lucide and Hugeicons Pro icons  |
| Rich text  | TipTap (`src/cms/PageEditor.tsx`)                                      |
| Data fetch | Plain `fetch` services (`src/services/*`), SWR in a few hooks          |
| Back end   | Vercel serverless functions in TypeScript (`api/`)                     |
| Database   | Neon Postgres; Drizzle for typed queries, raw SQL for the rest         |
| Storage    | Vercel Blob: a public store, and a private store for review images     |
| AI         | Claude (Anthropic) for vision, audits and agents; fal.ai for images and video; Magnific for icons |
| Email      | Resend                                                                 |
| Payments   | Stripe (invoices and webhooks)                                         |
| Analytics  | PostHog (first-party proxy per site) and Vercel Analytics              |
| Tests      | Vitest in real headless Chromium (Playwright), plus a Node project     |
| Lint       | Ultracite (Biome), oxlint with `@shadcn/lint`, custom checks           |
| Desktop    | Electron shell over the live site                                      |

---

## Repository map

```
api/                 Serverless endpoints, one file per route (Vercel file routing)
  _lib/              Shared server code: auth, db, blob, email, AI, MCP, audits
agents/audit/        The eve audit agent (its own npm package and Vercel project)
bruno/               Generated Bruno API collection
chrome-extension/    "Board capture" Chrome extension
config/              Code shared by browser and server: sites, theme, node types,
                     review model, fal models, social sizes
db/                  schema.sql, patches/*.sql (migrations), Drizzle schema
docs/                Design and pipeline notes
electron/            Desktop app (live browser node, Google sign-in)
logo-creator/        Vendored logo-creation skill (Python, fal)
loras/               LoRA weights for custom image models
schemas/             Zod models that generate openapi.json / openapi.yaml
scripts/             Dev stack, migrations, seeds, checks, bridges, scanners
skills/              Agent skills shipped with the repo
specs/               spec-kit specs for the canvas
src/
  boards/            The canvas: nodes, wires, tools, studio, creative editor
  cms/               Page editor and renderer
  components/        admin/, review/, brandGuide/, ui/ (shadcn)
  editor/            WebGL photo darkroom
  hooks/ lib/ services/ theme/
  pages/             Route pages (public and admin shells)
middleware.ts        Sends crawlers to /api/shell for share cards
vercel.json          Build, headers, rewrites, image hosts
```

---

## Capabilities

### Public sites

Routes are in `src/App.tsx`. Every page except the home page is
lazy-loaded.

| Route                          | Page                    | What it shows                                   |
| ------------------------------ | ----------------------- | ----------------------------------------------- |
| `/`                            | `HomePage`              | Gallery with category filters, lightbox, grid or stacked view |
| `/photo/:id`                   | `PhotoPage`             | One photo, with share buttons                    |
| `/board/:slug[/:frameSlug]`    | `BoardViewPage`         | A published board (dark), frames and comments    |
| `/board/:slug/present`         | `BoardPresentPage`      | Full-screen slide deck of a board's frames       |
| `/review/:slug`                | `ReviewPage`            | A design review, optionally password locked      |
| `/proposal/:slug`              | `ProposalPage`          | A client proposal, with acceptance               |
| `/contract/:id`                | `ContractPage`          | A contract to sign                               |
| `/privacy`, `/terms`           | `LegalPage`             | Legal pages                                      |
| `/reset-password`              | `ResetPasswordPage`     | Password reset                                   |
| `/:slug`                       | `ContentPage`           | Any CMS page (the catch-all, last)               |

**Theming per site.** `config/sites.ts` holds each site's fixed facts
(domain, email sender, origins). `src/theme/SiteSettingsProvider.tsx` paints
compiled defaults first, then loads the saved settings from
`/api/site-settings` and writes `--background`, `--foreground`, `--accent`
and the font stacks onto `:root`. An admin edits them in **Settings**: name,
tagline, colours, fonts, the shader background, and the colour of each kind
of review note.

The site is a PWA (service worker, manifest from `/api/manifest`). Crawlers
get server-rendered share cards from `/api/shell` (see `middleware.ts`).

### Admin

`/admin` signs in by email and password or Google. Sections are in
`src/pages/AdminPage.tsx`; the components are in `src/components/admin/`.

| Section      | Main component          | What it does                                                    |
| ------------ | ----------------------- | --------------------------------------------------------------- |
| Photos       | `src/components/Admin.tsx` | Library, batch upload, categories, details, WebGL darkroom editor (`src/editor/`), daily challenge |
| Boards       | `BoardsPanel`, `BoardEditor` | List and edit canvases (see below)                         |
| Collections  | `CollectionsPanel`      | Shared, unpublished material for the portfolio and boards        |
| Brand kits   | `BrandKitsPanel`        | Palettes, type, logos, voice, references, website scans; guide page at `/admin/brand-kits/:id/guide` |
| Lightroom    | `LightroomPanel`        | Browse an Adobe Lightroom catalogue and copy pictures in         |
| Pages        | `PagesPanel`            | CMS pages in TipTap, with media, icons and video                |
| Proposals    | `ProposalsPanel`        | Proposals, packages, process, sending, contracts, invoices      |
| Reviews      | `ReviewsPanel`          | Design reviews (see below)                                      |
| Invoices     | `InvoicesPanel`         | Stripe invoices; status follows Stripe webhooks                 |
| Models       | `ModelsPanel`           | The fal.ai models a Generate node may use, edited as data       |
| Settings     | `SiteSettingsPanel`, `SitesPanel` | Site settings; the owner can create new sites as Vercel projects |

Also: a notification bell (activity feed and web push), Canva and Pinterest
sending, Unsplash search, the Google Drive picker, and Framer page export.

### The canvas (boards)

A node-based moodboard in `src/boards/`. Items sit on a board; nodes have
typed input and output ports (image, text, video) joined by wires. Running a
node calls `POST /api/boards/:id/run`, one node per request; the browser
drives the whole graph (`src/boards/run/runStore.ts`,
`src/boards/hooks/useGraphRun.ts`).

**Node types** (registry: `config/nodeTypes.ts`, each defined in
`config/nodes/*.ts`, views in `src/boards/nodes/`):

`batch`, `brand`, `browser`, `bundle`, `clip`, `composite`, `cover`,
`describe` (Analyse), `element`, `generate`, `icon`, `iterate`, `join`
(Combine), `list`, `mockup`, `palette`, `prompt`, `standard` (Halftone),
`trace`, `video`, `wrap`.

Plain items (note, photo, reference, text, frame) also have output ports, and
frames collect inputs. The same port rules are shared by the canvas and the
API.

**Tools** (`src/boards/tools/registry.ts`, one list for the toolbar, the
right-click menu and chat commands): flip, crop, edit image, generate image,
replace area, restyle, remove background, vectorize, describe.

**Other parts:**

- **Studio** (`studio/`): generators for backgrounds, patterns, shapes and
  gradients in the active brand's colours.
- **Creative editor** (`creative/`): opens a frame as a design with text,
  shapes, layers and snapping; exports PNG, print PDF, HTML5 or video.
- **Drawing and masks** (`drawing/`), **shader effects** (`shaders/`),
  **colour variables** (`colorVars/`), **components** (`components/`),
  **brand proofs and logo boards** (`brand/`, `logo/`).
- **Import and export** (`io/`): the vector-editor bridge, CMYK PDF, Google
  Drive, HyperFrames.
- **Browser node**: a captured web page with pins and markup. In the desktop
  app it is a live embedded browser.
- **Publishing**: a published board is dark and public at `/board/:slug`;
  `/board/:slug/present` is a slide deck.

The canvas has a written design context: see the Design section of
[`AGENTS.md`](AGENTS.md) and `.impeccable.md`.

### Design reviews and the UX audit

A review is a client-facing UX critique of a website.

- **Editor** (`ReviewEditor.tsx`): a side panel on the left with save,
  publish, preview, PDF, send to board, settings, the audit, client access
  and sending. Beside it are the opening, sections, screens and closing.
  Every block folds away, and sections and screens are dragged into a new
  order by their handles. The draft saves itself 1.2 s after each change.
- **Screens**: capture a URL (desktop, or phone at most 420 px wide), or
  upload a screenshot. Then add numbered notes (issue, recommendation,
  suggestion, works well) and markup (box, highlight, arrow, pen). Select a
  mark to move it, reshape it, or delete it.
- **UX audit** (`api/reviews/audit.ts`, `api/_lib/uxAudit/`): Claude reviews
  every screen at full resolution in tiles, with the page's HTML, against
  the vendored references: heuristics, all 21 Laws of UX, the design
  references and the severity model. It writes the summary, sections and
  10–18 pinned findings per screen. The references are refreshed with
  `node scripts/vendor-ux-audit.mjs`.
- **Capture behind login**: the [audit agent](#the-audit-agent-agentsaudit)
  signs in to a client's app with a test account and captures the key pages.
- **Privacy**: review screenshots live in a private Blob store and are read
  through signed links that expire (`api/_lib/reviewImages.ts`). A review
  can have a password; the client's browser then holds a pass.
- **Client side** (`ReviewPage.tsx`): the client reads the review, adds
  comments, pins and drawings, and downloads a PDF.
- **Board sync**: send a review to a board as Browser nodes, work on it
  there, and publish it back. Pictures stay private in the review.

### Proposals, contracts and invoices

Proposals have packages, a process, a public page, email sending (Resend,
with delivery webhooks) and online acceptance. Accepting can draft a services
agreement (`/contract/:id`, signed online). Invoices are created in Stripe and
updated by its webhooks. PDFs are rendered on the server.

### Brand kits

A brand kit holds a palette, type, logos, voice and dated references, and can
have a parent kit. `pnpm design-md:scan` reads a brand's live websites with
Playwright and saves components, type scale, radii and spacing. Each kit can
be written out as a `DESIGN.md` (`pnpm design-md:sync`, optionally on a
15-minute launchd job). Kits theme boards, proposals and reviews.

---

## MCP server

The site is an MCP server, so Claude (or any MCP client) can read and update
the business. Code: `api/mcp/[key].ts`, `api/_lib/mcp.ts`,
`api/_lib/mcpTools.ts`, `api/_lib/mcpBrandTools.ts`.

**Transport:** Streamable HTTP, stateless JSON-RPC 2.0, `POST` only.
Supports `initialize`, `ping`, `tools/list` and `tools/call`. Read-only tools
carry `readOnlyHint`.

**Authentication:** `MCP_ACCESS_TOKEN` (at least 32 characters; the endpoint
is off without it).

- Claude custom connector (takes a URL only):
  `https://<site>/api/mcp/<MCP_ACCESS_TOKEN>`
- Clients that send headers: `POST /api/mcp/connect` with
  `Authorization: Bearer <MCP_ACCESS_TOKEN>`

The check is constant-time. Rotate the token and redeploy to revoke every copy.

**Site tools**

| Tool              | Writes | What it does                                                        |
| ----------------- | :----: | ------------------------------------------------------------------- |
| `site_overview`   |        | Proposals by status, invoices outstanding and paid (90 days), unread activity, reviews, photo count |
| `list_proposals`  |        | Every proposal with status, sent/accepted, and the chosen option    |
| `get_proposal`    |        | One proposal in full, as text                                       |
| `get_agreement`   |        | The services agreement drafted from a proposal                      |
| `list_invoices`   |        | Invoices with lines, totals, status and pay link                    |
| `draft_invoice`   |   ✓    | Saves a draft invoice (in cents); it is sent later from the admin   |
| `list_reviews`    |        | Design reviews with screen and note counts, and whether sent        |
| `recent_activity` |        | The activity feed                                                   |
| `search_photos`   |        | Searches photo titles and alt text, optionally in one category      |

**Brand tools**

| Tool                     | Writes | What it does                                                 |
| ------------------------ | :----: | ------------------------------------------------------------ |
| `list_brand_kits`        |        | Every kit with its parent, reference count and version       |
| `get_brand_kit`          |        | One kit in full, with its parent folded in                    |
| `get_design_md`          |        | The kit as a DESIGN.md file                                   |
| `set_brand_palette`      |   ✓    | Replaces the palette, as a new version                        |
| `set_brand_scan`         |   ✓    | Saves website scan results                                    |
| `add_brand_reference`    |   ✓    | Adds a dated note with its source; skips exact duplicates     |
| `remove_brand_reference` |   ✓    | Removes one reference by id, as a new version                 |

`scripts/siteConnector.mjs` calls these tools from scripts (it needs
`MCP_ACCESS_TOKEN`; `DESIGN_MD_SITE` points it at another deployment).

The repo's own `.mcp.json` is separate: it gives local coding agents a
`chrome-devtools` MCP server for browser work.

---

## The audit agent (`agents/audit`)

An eve agent that powers **Reviews →
Capture behind login**. It signs in to a client's app with a test account,
finds the key pages, and captures each at desktop and phone width into the
private review Blob store. The site then runs its UX audit on the pictures.

- **Model:** `claude-opus-5-5`. Cost cap $5 per session.
- **Tools:** `log_in` (types `LOGIN_USER` / `LOGIN_PASS`, which the model
  never sees), `capture_screen` (full-page, 2× resolution, to private Blob),
  and the eve Chromium browser tools.
- **Instructions:** `agent/instructions/00-role.md`, plus 18 reference files
  loaded into context by `10-references.ts`.
- **API:** the site starts a session and polls it through
  `api/_lib/reviewAgent.ts` and `api/reviews/explore.ts`, with
  `EVE_AGENT_URL` and `EVE_API_TOKEN`.

**Deploying:** it is its own Vercel project, `audit-agent`, with Root
Directory `agents/audit`. Pushing `main` with a change under `agents/audit`
builds it; other pushes skip it. **Never clear the Root Directory**: an empty
one deploys the photo site onto the agent's address. `npx eve deploy` does
not work with this setup.

Environment (Vercel, synced from Doppler `ux-audits/prd`):
`ANTHROPIC_API_KEY`, `EVE_API_TOKEN`, `LOGIN_USER`, `LOGIN_PASS`,
`REVIEW_BLOB_READ_WRITE_TOKEN`; optional `LOGIN_URL` and the
`LOGIN_*_SELECTOR` overrides.

Run it locally (Node 24+, Docker running): see
[`agents/audit/README.md`](agents/audit/README.md).

---

## Side tools

| Tool | Where | What it does |
| ---- | ----- | ------------ |
| Board capture extension | `chrome-extension/board-capture/` | Screenshots the current page (whole or visible, stitched up to 12,000 px) onto the open board as a Browser node. Alt+Shift+S. Load unpacked. |
| Desktop app | `electron/` | "Photos" for macOS, a shell over the live site. The Browser node becomes a live embedded browser; Google sign-in uses the loopback flow with PKCE. `pnpm electron:dev`, `pnpm electron:build`. |
| Vector-editor bridge | `scripts/affinity-bridge.mjs` (`pnpm bridge`) | "Open in <editor>" on the canvas: opens an SVG in Affinity, Boxy SVG, Inkscape or Illustrator and writes edits back. Port 4123. |
| Brand scanner | `scripts/scan-design.mjs` (`pnpm design-md:scan`) | Reads a brand's live sites with Playwright into its kit. `--all`, `--dry`. |
| DESIGN.md sync | `scripts/sync-design-md.mjs` | Writes each kit's DESIGN.md into the Obsidian vault; `--install` adds a launchd job. |
| Logo creator | `logo-creator/` | Python logo pipeline on fal (generate, crop, remove background, vectorize). Needs `FAL_API_KEY`. In the app: Boards → New logo board. |
| LoRA upload | `scripts/upload-lora.ts` (`pnpm lora:upload`) | Puts LoRA weights in Blob and prints the URL for `config/nodeTypes.ts`. |
| UX audit references | `scripts/vendor-ux-audit.mjs` | Copies the ux-audit skill and references into the site and the agent. |

---

## API

Every file under `api/` is a route (Vercel file routing). Folders starting
with `_` are not routes. Areas:

| Area | Paths |
| ---- | ----- |
| Auth | `auth/login`, `auth/google`, `auth/register`, `auth/me`, `auth/change-password`, `auth/forgot-password`, `auth/reset-password` |
| Photos | `photos`, `photos/:id` (+ `reset`, `rotate`), `photos/batch`, `photos/batch-delete`, `photos/reorder`, `categories`, `collections` |
| Boards | `boards`, `boards/:id` (+ `comments`, `dataset`, `export`, `result`, `svg`, `version`, `video`, `run`), `boards/adopt`, `boards/print-pdf`, `elements`, `recipes`, `models` (+ `train`, `training`) |
| Reviews | `reviews`, `reviews/:slug` (+ `feedback`, `pdf`, `send`), `reviews/audit`, `reviews/capture`, `reviews/browse`, `reviews/explore` |
| Business | `proposals` (+ `accept`, `invoices`, `pdf`, `send`), `contracts/:id` (+ `pdf`), `invoices`, `brand-kits` |
| Content | `pages`, `site-settings`, `upload` (signed browser uploads to Blob) |
| AI | `ai/generate` (fal), `ai/icon` (Magnific) + `ai/icon-webhook`, `fal/library`, `claude-status` |
| Integrations | `canva/*`, `lightroom/*`, `pinterest/*`, `framer/page`, `unsplash/search`, `google/picker-config` |
| Other | `daily-challenge`, `notifications` (+ `push`), `sites/provision`, `sites/setup`, `mcp/:key` |
| Public plumbing | `shell` (share cards), `manifest`, `robots`, `sitemap` |
| Webhooks | `webhooks/stripe`, `webhooks/resend` |

**Docs:** `schemas/*.ts` (zod) generate `openapi.json`, `openapi.yaml` and
the `bruno/` collection with `pnpm api:docs`. CI fails if the committed copies
are out of date, so run it after changing an endpoint.

**Auth model:** admins sign in with email and password (bcrypt) or Google
(existing users only) and get a 7-day JWT, sent as `Authorization: Bearer`.
Everyone in `users` is an admin; `OWNER_EMAIL` is the owner, who alone can
create sites. Sign-up is off unless `ADMIN_SETUP_SECRET` is set. Reviews can
have a password (scrypt hash; changing it ends every old pass).

**Claude on the server:** `api/_lib/claudeAuth.ts` trades Vercel's OIDC token
for a short-lived Anthropic token (workload identity federation), so no API
key is stored. `ANTHROPIC_API_KEY` is only a fallback.

---

## Databases

> **Development and Production point at the same Neon database.** The two
> connection strings differ only by password. `pnpm dev` reads and writes the
> live site. Run `pnpm db:info` before anything destructive: it prints the
> host and the Postgres `system_identifier`, the only reliable way to tell
> whether two URLs are the same database. `AGENTS.md` explains how to give
> local development its own Neon branch.

- **Schema:** `db/schema.sql` plus `db/patches/*.sql` (001–051) are the
  source of truth. Every patch is idempotent (`IF NOT EXISTS`).
- **Drizzle:** `db/schema.ts` is generated with `pnpm db:pull`; the client is
  `api/_lib/orm.ts`. Some tables (proposals, reviews, invoices, contracts,
  activity, …) are only in SQL and queried with raw SQL (`api/_lib/db.ts`).
  New work should use Drizzle.
- **Migrating:** `pnpm db:migrate` applies `schema.sql` then every patch in
  order. To migrate another site:
  ```bash
  DATABASE_URL='<that site’s production string>' pnpm db:migrate
  ```
- **Migrate every database before deploying code that reads a new column.**
  `PHOTO_COLUMNS` feeds both `api/photos/index.ts` and `api/shell.ts`, so one
  missing column takes every photo endpoint down on that site.
- `vercel env pull` defaults to the Development environment. Pass
  `--environment=production` when you need the production string.
- Only `site_settings` is keyed by site. Nothing else is shared.

---

## Environment variables

`.env.example` is the template. Locally, values come from `.env`,
`.env.local` and `.env.development.local` (`pnpm vercel:env:pull`). In
production they are set per Vercel project. **(S)** marks a secret.

| Group | Variables |
| ----- | --------- |
| Site | `SITE` (server), `VITE_SITE` (build); optional `SITE_*` overrides in `config/sites.ts` |
| Database | `DATABASE_URL` (S) (or `POSTGRES_URL`, `POSTGRES_PRISMA_URL`); `TARGET_DATABASE_URL` (S) for `migrate-target` |
| Auth | `JWT_SECRET` (S, 16+ chars), `BROWSER_LOGIN_KEY` (S), `ADMIN_SETUP_SECRET` (S), `OWNER_EMAIL`, `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY`, `CORS_ALLOWED_ORIGINS` |
| Storage | `BLOB_READ_WRITE_TOKEN` (S, public store), `REVIEW_BLOB_READ_WRITE_TOKEN` (S, private review store) |
| AI | `FAL_API_KEY` (S), `MAGNIFIC_API_KEY` (S), `ANTHROPIC_API_KEY` (S, fallback), `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID`, `ANTHROPIC_WORKSPACE_ID` |
| Audit agent | `EVE_AGENT_URL`, `EVE_API_TOKEN` (S) |
| MCP | `MCP_ACCESS_TOKEN` (S, 32+ chars) |
| Email and push | `RESEND_API_KEY` (S), `RESEND_WEBHOOK_SECRET` (S), `SLACK_WEBHOOK_URL` (S), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (S), `VAPID_SUBJECT` |
| Payments | `STRIPE_SECRET_KEY` (S), `STRIPE_WEBHOOK_SECRET` (S) |
| Integrations | `UNSPLASH_ACCESS_KEY` (S), `ADOBE_CLIENT_ID`, `ADOBE_CLIENT_SECRET` (S), `ADOBE_REDIRECT_URI`, `CANVA_REDIRECT_URI` |
| Site provisioning | `VERCEL_TOKEN` (S), `VERCEL_TEAM_ID`, `SITES_REPO` |
| Analytics | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_UI_HOST`; scripts: `POSTHOG_API_KEY` (S), `POSTHOG_HOST`, `POSTHOG_PROJECT_ID` |
| Dev | `PORT`, `API_PORT`, `VITE_API_BASE_URL`, `VITE_API_PROXY_TARGET`, `DISABLE_HMR`, `DEV_STACK` |
| Desktop and bridge | `ELECTRON_SITE`, `ELECTRON_ORIGIN`, `ELECTRON_BYPASS`, `GOOGLE_DESKTOP_CLIENT_FILE`, `VECTOR_APP`, `VECTOR_PORT`, `VITE_AFFINITY_BRIDGE_ORIGIN` |
| Install | `HUGEICONS_TOKEN` (S) |

Doppler holds the Hugeicons token (`photo-portfolio`) and the audit agent's
secrets (`ux-audits/prd`). The app itself does not call Doppler.

---

## Commands

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` / `dev:addison` / `dev:cyan` | Full local stack for one site (dallas-images by default) |
| `pnpm dev:vercel` | The same, on `vercel dev` |
| `pnpm dev:api` | The API server alone |
| `pnpm build` / `build:<site>` | Production build |
| `pnpm preview` | Serve the build |
| `pnpm test` / `test:watch` | Vitest |
| `pnpm shots` | Shader screenshots in Google Chrome (WebGPU), local only |
| `pnpm lint` | `tsc` plus the custom checks (below) |
| `pnpm lint:ui` | oxlint with `@shadcn/lint` (no arbitrary Tailwind values) |
| `pnpm dlx ultracite check` / `pnpm fix` | Biome check / fix |
| `pnpm api:docs` | Regenerate `openapi.json`, `openapi.yaml`, `bruno/` |
| `pnpm db:info` | Which database am I on, really |
| `pnpm db:migrate` | Apply `schema.sql` and every patch |
| `pnpm db:pull` | Regenerate the Drizzle schema |
| `pnpm db:seed` / `db:add-user` / `db:verify-login` | Seed data, add a user, test a login |
| `pnpm board:restore` | Copy one board back from a Neon point-in-time branch (`--apply` to write) |
| `pnpm cover:seed` / `pages:seed` / `proposal:seed` | Seed demo boards |
| `pnpm bridge` | Vector-editor bridge |
| `pnpm design-md:scan` / `design-md:sync` | Scan brand sites / write DESIGN.md files |
| `pnpm lora:upload` | Upload LoRA weights |
| `pnpm electron:dev` / `electron:build` | Desktop app |
| `pnpm vercel:env:pull` | Pull env into `.env.development.local` |

---

## Testing

```bash
pnpm exec playwright install chromium   # once
pnpm test                               # everything
pnpm vitest run path/to/file.test.tsx   # one file
pnpm vitest run --project node          # server tests only
```

`vitest.config.ts` has two projects:

- **browser**: real headless Chromium (Playwright). All `*.test.ts(x)` under
  `src/`, `config/` and `api/`. Tailwind is loaded, so sizes and hit-testing
  are real. Canvas code needs this: jsdom returns `null` from `getContext`
  and every assertion would pass.
- **node**: `api/**/*.node.test.ts`, for code that touches env, fs, fetch or
  the database (stubbed).

For pointer behaviour, prefer `userEvent` from `vitest/browser`: it clicks
what is really on top. A dispatched event skips hit-testing and can pass when
the real click fails.

---

## Lint and quality gates

`pnpm lint` runs, in order:

1. `tsc --noEmit`
2. `check:esm` — every relative import in `api/` and `db/` names its file
   extension. Without it, code passes tsc and tests but fails when deployed.
3. `check:size` — a 600-line ceiling per file, as a ratchet against
   `file-size-baseline.json`. Listed files may not grow. After shrinking one,
   run `pnpm check:size --update`.
4. `check:migrations` — blocks `DELETE`, `TRUNCATE`, `DROP TABLE` and
   `DROP COLUMN`; `INSERT` only with `ON CONFLICT`. Anything else needs a
   `-- migration-safety: <why>` comment on the line before.
5. `check:utilities` — no Tailwind utility classes in `src/boards` or
   `src/pages`; BEM classes only.
6. `oxlint src` — `@shadcn/lint`: no arbitrary values, no restyling a ui
   component (see below).

Also:

- **Ultracite / Biome** (`biome.jsonc`) for format and lint. The pre-commit
  hook (`.husky/pre-commit`) runs `ultracite fix` on staged files.
- **@shadcn/lint** (`pnpm lint:ui`), run through Oxlint and configured in
  `.oxlintrc.json`. It finds components, aliases and the theme from
  `components.json` and `src/index.css`. Enabled rule:
  `shadcn/no-arbitrary-values` (use theme tokens, not `[calc(...)]`-style
  values). Other rules — `no-restyle`, `no-raw-colors`, `no-inline-styles`,
  `no-unknown-classes`, `require-static-classes` — are added in that file;
  see the [rule docs](https://github.com/shadcn-ui/lint/blob/main/README.md#rules).
  `no-restyle` is on too: a ui component's look is a variant in
  `src/components/ui`, never classes at the call site. Both run in
  `pnpm lint`, so CI fails on any finding.
- **CI** (`.github/workflows/ci.yml`, on push to `main` and PRs): install,
  Playwright Chromium, `pnpm lint`, `ultracite check`, `pnpm test`,
  `pnpm build`, and the OpenAPI drift check.

---

## Development patterns

- **Query CodeGraph first.** `.codegraph/` indexes the repo. Use
  `codegraph explore "<symbols or question>"` (or the `codegraph_explore`
  MCP tool) before grep. Read the blast radius before changing a shared
  symbol.
- **Shared code lives in `config/`.** Anything both the browser and the
  server need (node types, the review model, site and theme rules) goes
  there, with `.js` extensions on relative imports.
- **Styling:**
  - `src/boards` and `src/pages`: named BEM classes in a co-located
    `Component.css`, against theme variables (see `src/boards/nodes/OpNodeView.css`).
  - Admin and components: Tailwind utilities on the tokens in
    `src/index.css` (`--spacing` is 0.28rem, `--container-8xl`,
    `--container-phone`, `--container-panel`, `--z-menu`). No arbitrary
    values; add a token instead.
  - UI primitives come from `src/components/ui` (shadcn on Base UI). Every
    dropdown uses `ui/select.tsx`; pass `items` so the closed trigger shows
    the label.
  - The canvas design context ("machined, quiet, unfashionable") is in
    `AGENTS.md` and `.impeccable.md`. Public sites are themed from the
    database instead.
- **Theme values are data.** Colours are stored as hex in `site_settings`
  and written to CSS variables at runtime, because Tailwind cannot generate
  classes from a database row.
- **Client data:** services in `src/services/*` call `/api` with the bearer
  token. There is no global store; use React state, context, small stores
  and SWR.
- **Long-running work runs in the browser.** A board run is one node per
  request; the review audit is one Claude call per screen, in parallel.
- **Private by default for client material.** Review images go to the
  private Blob store and leave only as signed links; a save strips the
  signature again.
- **Sticky UI respects the admin bar.** `AdminPage` publishes
  `--admin-bar-height`; sticky elements use it in their `top`. Use
  `overflow: clip`, not `hidden`, on ancestors of sticky elements.
- **Keep files under 600 lines.** Split by responsibility (for example
  `ReviewEditorActions.tsx` and `ReviewEditorPanel.tsx` beside
  `ReviewEditor.tsx`).
- **Verify in a real browser** before calling a UI fix done. Reproduce, don't
  reason from source.
- **Agent tooling in the repo:** `AGENTS.md` (rules), `.github/agents` and
  `.github/skills` (impeccable), `.github/hooks` (Ultracite after edits),
  `.specify/` and `specs/` (spec-kit), `.rm-vault/` (RoleModel Vault board,
  card prefix `ADD`).

---

## Deploying

- **Photo sites:** each is a Vercel project. Pushing `main` deploys
  **dallas-images** automatically. **addison** and **cyan** need a manual
  deploy.
- **Build:** `vercel.json` runs `pnpm db:migrate` before `pnpm build` on
  **production** deploys only (preview deploys skip it). Migrate the other
  sites' databases by hand before deploying code that needs a new column.
- **Install:** `pnpm install` with the Hugeicons token from
  `HUGEICONS_TOKEN`.
- **Audit agent:** see [above](#the-audit-agent-agentsaudit).
- **Headers and routing:** `vercel.json` sets security headers, rewrites
  `/robots.txt` and `/sitemap.xml`, sends crawlers to `/api/shell`, and serves
  `index.html` for everything else.

---

## Further reading

| File | What it covers |
| ---- | -------------- |
| [`AGENTS.md`](AGENTS.md) | Rules that have broken production, commands, code standards, canvas design context |
| [`HANDOFF.md`](HANDOFF.md) | Current board and node work, and how to work on it |
| [`agents/audit/README.md`](agents/audit/README.md) | The audit agent in detail |
| [`chrome-extension/board-capture/README.md`](chrome-extension/board-capture/README.md) | Installing the capture extension |
| `docs/canvas-baseline.md` | Canvas performance baseline |
| `docs/canvas-wave-0.md` | Plan to move the viewport out of React state |
| `docs/cover-pipeline.md` | Book cover from parts to print and mockup |
| `docs/social-sizes.md` | Sources for social sizes and safe zones |
| `specs/001-node-canvas-workflow/`, `specs/002-daily-design-canvas/` | spec-kit specs for the canvas |
| `openapi.yaml`, `bruno/` | The API, generated |
