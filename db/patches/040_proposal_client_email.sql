-- Where the client's copy goes when they accept.
--
-- One address per proposal, typed in the admin beside the client label. The
-- acceptance email (039) goes to the owner; this is the client's own copy of
-- what they signed, sent to the address on file rather than one they type
-- on the page, so the record of who was sent what stays with the proposal.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_email TEXT;
