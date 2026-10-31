-- Agreements, invoice line items, and invoice templates.
--
-- contracts: the services agreement for an accepted proposal. It is built
-- from the proposal (the option the client chose, its price, payment,
-- timeline and revisions, plus the standard clauses) and then edited freely
-- while it is a draft. Sending it opens it for the client's signature at
-- /contract/<id> — the id, not the proposal's slug, so the address cannot be
-- guessed. The client signs by typing their name; the owner countersigns from
-- the admin. The signed text is frozen: once the client has signed, doc can
-- no longer change.
--
-- invoices.lines: an invoice can now carry several line items
-- ([{description, amountCents}]). When null, the single description and
-- amount_cents describe the one line, as before; amount_cents always holds
-- the total.
--
-- invoice_templates: saved starting points for an invoice — its lines, how
-- long the client has to pay, and a memo — so a deposit or a monthly retainer
-- is two clicks rather than retyped.

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID UNIQUE REFERENCES proposals (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(doc) = 'object'),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'countersigned')),
  sent_at TIMESTAMPTZ,
  client_signed_at TIMESTAMPTZ,
  client_signed_name TEXT,
  client_signed_title TEXT,
  client_signed_ip TEXT,
  owner_signed_at TIMESTAMPTZ,
  owner_signed_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_updated_idx
  ON contracts (updated_at DESC);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS lines JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS memo TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lines) = 'array'),
  due_days INTEGER NOT NULL DEFAULT 14 CHECK (due_days BETWEEN 0 AND 365),
  memo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
