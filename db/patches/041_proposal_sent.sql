-- When the proposal was sent to the client, and to which address.
--
-- "Send to client" in the admin emails the link to the client address on
-- file (040). These two columns are the record of that: the last send wins,
-- since a proposal is usually sent once and re-sent only after an edit, and
-- what matters is whether it has gone out and where.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_to TEXT;
