-- Proposals: a priced offer to one client, written in the admin and shared at
-- its own address.
--
-- A proposal is a page you send once, so it is not a CMS page (005): it never
-- appears in the nav, it carries packages and prices rather than free prose,
-- and it is labelled for a client rather than for the site. It points at a
-- brand kit (031) when one exists for that client, which is what lets the
-- public page pick up the client's accent colour without the kit itself ever
-- leaving the admin.
--
-- The body is one JSONB document, bounded by config/proposal.ts, for the same
-- reason brand kits are: it is always read whole and never queried into.
--
-- `client_name` is deliberately separate from the kit's name. A kit is named
-- for the brand ("Viaskai"); a proposal is addressed to whoever is reading it
-- ("Vin at Viaskai"), and the two drift apart as soon as the brand has a
-- product with its own name.
--
-- Idempotent like every patch. No existing row is touched.

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  brand_kit_id UUID REFERENCES brand_kits (id) ON DELETE SET NULL,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL
);

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_doc_object;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_doc_object CHECK (jsonb_typeof(doc) = 'object');

-- The admin list is newest-first; the public page is a point lookup by slug,
-- which the UNIQUE already covers.
CREATE INDEX IF NOT EXISTS proposals_updated_idx ON proposals (updated_at DESC);
CREATE INDEX IF NOT EXISTS proposals_kit_idx ON proposals (brand_kit_id)
  WHERE brand_kit_id IS NOT NULL;
