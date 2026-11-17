-- People other than the owner, and the boards they may open.
--
-- users.role: 'admin' reaches everything, as every account did before this;
-- 'member' reaches only the boards board_members gives it. Existing rows are
-- the owner's, so they are added as admin, and new rows default to member,
-- so an account made later never reaches the admin by accident.
--
-- A member signs in through Neon Auth (Google), so has no password here.
--
-- Schema only. Idempotent like every patch.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

-- migration-safety: changes only what a future row gets; no row is touched
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'member';

-- migration-safety: loosens a constraint; no row is touched
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS board_members (
  board_id uuid NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS board_members_user_idx ON board_members (user_id);
