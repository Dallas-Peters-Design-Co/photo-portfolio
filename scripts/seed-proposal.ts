/**
 * seed-proposal.ts - write the Viaskai / Pretext proposal into the database.
 *
 *   SITE=dallas-images pnpm proposal:seed [--replace] [--kit "Viaskai"]
 *
 * Inserts the proposal as a draft at /proposal/viaskai-pretext-launch. A
 * second run does nothing unless --replace is passed, so a proposal edited in
 * the admin is not quietly overwritten by re-running a script. --kit names a
 * brand kit to attach; when it is omitted, or no kit by that name exists, the
 * proposal is created without one and can be attached later in the admin.
 *
 * This is the only place the Viaskai-specific content lives in code. The
 * standard sections come from DEFAULT_PROPOSAL_DOC, so an edit there reaches
 * every new proposal; the packages and the summary below are this client's.
 */
import pg from "pg";
import {
  DEFAULT_PROPOSAL_DOC,
  type ProposalDoc,
  sanitizeProposalDoc,
} from "../config/proposal";
import { loadEnv } from "./loadEnv";

loadEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required (set in .env, .env.local, or .env.development.local)"
  );
}

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (flag: string): boolean => process.argv.indexOf(flag) !== -1;

const SLUG = "viaskai-pretext-launch";
const TITLE = "Pretext launch: brand, product and promotion";
const CLIENT = "Vin at Viaskai";

const doc: ProposalDoc = sanitizeProposalDoc({
  ...DEFAULT_PROPOSAL_DOC,
  addOns: [
    {
      id: "addon-framer",
      name: "Early-access landing page built in Framer instead of a Figma handoff",
      price: "+$1,500",
    },
    {
      id: "addon-video",
      name: "30 to 60 second product walkthrough video (storyboard and motion, no voiceover)",
      price: "+$3,000",
    },
    {
      id: "addon-deck",
      name: "Pitch or investor deck template, 12 to 15 slides",
      price: "+$2,000",
    },
    { id: "addon-revision", name: "Extra revision round", price: "+$500" },
    {
      id: "addon-rush",
      name: "Rush delivery, under half the listed timeline",
      price: "+25%",
    },
  ],
  intro:
    "Thanks for the conversation, and for the introduction through Mitch. This is what I heard, what I'd suggest, and what it costs. It's written so you can forward it to anyone else at Viaskai who needs to weigh in.",
  packages: [
    {
      bestFor:
        "You want a professional read on the product and brand first, and aren't yet sure how much of the launch work to hand over.",
      id: "pkg-audit",
      includes: [
        "Written review of the Pretext UI and the Viaskai brand, with annotated screenshots",
        "Palette, type and hierarchy recommendations",
        "A view on Viaskai vs. Pretext as brands: one or two, and which leads",
        "A prioritised fix list, ordered by what a pharma buyer will notice first",
        "60-minute readout call",
      ],
      name: "Brand and product audit",
      payment: "100% up front",
      price: "$2,500",
      priceNote: "fixed",
      recommended: false,
      revisions: "1 round",
      timeline: "2 weeks",
    },
    {
      bestFor:
        "Launch is happening before the end of the year and you need the material to be ready for it.",
      id: "pkg-launch",
      includes: [
        "Everything in the audit",
        "Refined visual identity for Pretext: colour, type, logo lockup and a usage sheet",
        "Early-access landing page, designed in Figma and ready for your developer",
        "Product screenshot set and two to three hero mockups",
        "Launch asset kit: LinkedIn carousel, OG image, email header, one-page PDF for partners",
      ],
      name: "Launch package",
      payment: "50% to start, 50% at delivery",
      price: "$9,500",
      priceNote: "fixed",
      recommended: true,
      revisions: "2 rounds per deliverable",
      timeline: "6 to 8 weeks",
    },
    {
      bestFor:
        "You want a designer on call through launch and into early access, iterating as partner feedback comes in.",
      id: "pkg-partner",
      includes: [
        "Everything in the launch package",
        "Ongoing UI design on Pretext itself",
        "Launch-day assets and any conference or investor deck",
        "Iteration on the product and the site as early-access feedback arrives",
      ],
      name: "Launch partner",
      payment: "Monthly, in advance",
      price: "$5,000 / month",
      priceNote: "3-month minimum",
      recommended: false,
      revisions: "Continuous",
      timeline: "November through January, then month to month",
    },
  ],
  summary:
    "Pretext is an AI-assisted authoring platform that takes a study from data through to a publication-ready manuscript, for pharma medical writing teams, communications agencies and academic researchers. It's in development, with early access for development partners planned before the end of the year.\n\nYou asked for two things: promotional material for the launch, and a professional opinion on the product's current look, branding and colour choices. Those are really three pieces of work (a brand and UI review, a visual identity for Pretext, and the launch material itself), so the options below are built up in that order.",
  validUntil: "2026-11-15",
});

const client = new pg.Client({ connectionString });
await client.connect();
try {
  let kitId: string | null = null;
  const kitName = arg("--kit");
  if (kitName) {
    const kit = await client.query<{ id: string }>(
      "SELECT id FROM brand_kits WHERE lower(name) = lower($1) LIMIT 1",
      [kitName]
    );
    kitId = kit.rows[0]?.id ?? null;
    if (!kitId) {
      console.warn(`No brand kit named "${kitName}"; creating without one.`);
    }
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO proposals (slug, title, client_name, brand_kit_id, doc, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'draft')
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [SLUG, TITLE, CLIENT, kitId, JSON.stringify(doc)]
  );

  if (inserted.rowCount && inserted.rowCount > 0) {
    console.log(`Created /proposal/${SLUG} as a draft.`);
  } else if (has("--replace")) {
    await client.query(
      `UPDATE proposals
       SET title = $2, client_name = $3, brand_kit_id = COALESCE($4, brand_kit_id),
           doc = $5::jsonb, updated_at = now()
       WHERE slug = $1`,
      [SLUG, TITLE, CLIENT, kitId, JSON.stringify(doc)]
    );
    console.log(`Replaced /proposal/${SLUG} with the seed content.`);
  } else {
    console.log(
      `/proposal/${SLUG} already exists; left as is. Pass --replace to overwrite it.`
    );
  }
} finally {
  await client.end();
}
