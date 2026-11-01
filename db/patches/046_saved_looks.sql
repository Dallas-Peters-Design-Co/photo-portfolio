-- Saved looks: a photo-editor grade, saved under a name.
--
-- The editor's built-in looks are code (src/editor/presets.ts). A saved look
-- is one Dallas made himself, by choosing a look and adjusting the sliders,
-- and wants back by name: "Bird Creek Warm". The edit is the editor's whole
-- EditState as JSON; the editor merges it onto neutral when it loads, so a
-- look saved before a new adjustment existed still opens.
--
-- A brand kit points at a look by id (doc.look.id). Built-in looks keep their
-- ids; a saved look is referenced as "saved:<uuid>".

CREATE TABLE IF NOT EXISTS saved_looks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  edit JSONB NOT NULL CHECK (jsonb_typeof(edit) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_looks_name_idx ON saved_looks (lower(name));
