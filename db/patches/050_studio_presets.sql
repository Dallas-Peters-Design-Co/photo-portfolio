-- Studio presets: a Studio tool's settings, saved under a name, so the same
-- look can be made again on another frame ("2027 · yellow flow").
--
-- `values` is the tool's settings as the Studio sent them, the same shape a
-- placed Studio picture keeps in config.studio.values. The picture a mosaic
-- was made from isn't part of a preset; the settings are.
--
-- Schema only.

CREATE TABLE IF NOT EXISTS studio_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool TEXT NOT NULL CHECK (tool ~ '^[a-z][a-z0-9-]{0,39}$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  "values" JSONB NOT NULL CHECK (jsonb_typeof("values") = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_presets_tool_idx
  ON studio_presets (tool, lower(name));
