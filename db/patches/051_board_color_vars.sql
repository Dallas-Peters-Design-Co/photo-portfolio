-- Colour variables: named colours kept on a board.
--
-- A layer uses a variable by having its colour; changing the variable changes
-- that colour on every layer that has it (src/boards/colorVars). The board
-- only stores the list: [{ "id", "name", "value": "#rrggbb" }].
--
-- Schema only. Idempotent like every patch.

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS color_vars JSONB NOT NULL DEFAULT '[]'::jsonb;
