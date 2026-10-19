-- Activity, browser-push subscriptions, and invoices.
--
-- activity: one row per thing that happened to a proposal or an invoice —
-- the link was sent, the email was delivered or opened, the client opened
-- the page or signed it, an invoice was drafted, sent or paid. It is both the
-- timeline on a proposal and the admin's notifications (unread until
-- read_at is set). dedupe_key is the upstream event's id (Resend's svix-id,
-- Stripe's event id) so a webhook delivered twice records once.
--
-- push_subscriptions: the browsers the owner turned notifications on in,
-- keyed by the push service endpoint the browser handed back.
--
-- invoices: what was billed against a proposal. A row starts as a local
-- draft (drafted when the client signs, or by hand) and is created in
-- Stripe only when it is sent, so a draft can be edited freely and nothing
-- reaches Stripe until the owner says so. The Stripe ids and URLs are filled
-- in on send; the status follows Stripe's webhooks after that.

CREATE TABLE IF NOT EXISTS activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  url TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS activity_created_idx
  ON activity (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_subject_idx
  ON activity (subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_unread_idx
  ON activity (created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  due_days INTEGER NOT NULL DEFAULT 14 CHECK (due_days BETWEEN 0 AND 365),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  stripe_invoice_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  number TEXT,
  hosted_url TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS invoices_proposal_idx
  ON invoices (proposal_id, created_at);
