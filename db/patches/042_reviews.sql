-- Reviews: an annotated walkthrough of a client's website or app, written in
-- the admin and shared at its own address, the way a proposal (038) is.
--
-- A review is screenshots with numbered notes pinned on them. The screens,
-- their images (captured from a URL or uploaded) and the pins live in one
-- JSONB document bounded by config/review.ts, always read whole. The images
-- themselves are in blob storage; the document holds their URLs.
--
-- Same shape as proposals for the parts that are the same job: a slug, a
-- client label and email, an optional brand kit for the accent, draft or
-- published, and when the link last went out.

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  brand_kit_id UUID REFERENCES brand_kits (id) ON DELETE SET NULL,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sent_at TIMESTAMPTZ,
  sent_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL
);

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_doc_object;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_doc_object CHECK (jsonb_typeof(doc) = 'object');

CREATE INDEX IF NOT EXISTS reviews_updated_idx ON reviews (updated_at DESC);
