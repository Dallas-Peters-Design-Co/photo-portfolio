-- Acceptance of a proposal, recorded on the proposal itself.
--
-- The client types a name and a title under the signature line and presses
-- Accept; the page writes these three columns once and shows them from then
-- on. One acceptance per proposal: a re-send is a new proposal, not a second
-- signature on the old one, which is why this is columns and not a table.
--
-- `accepted_option` names the package chosen (its id in the doc), so a
-- proposal with three options records which one was accepted.
--
-- All nullable, nothing rewritten, idempotent like every patch.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS accepted_name TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS accepted_title TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS accepted_option TEXT;
