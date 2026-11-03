-- Brand components: a group of frame-editor layers saved under a name, kept
-- with a brand kit, and dropped into any frame on any board as a linked copy.
--
-- `layers` is the group as the frame editor sent it: each layer's kind,
-- geometry relative to the group's top-left, text, style and settings. The
-- copies on boards are ordinary board items that point back here
-- (config.component), so everything that draws, prints or exports a board
-- works on them unchanged; this row is what they are brought back in line
-- with when the component is updated.
--
-- Schema only.

CREATE TABLE IF NOT EXISTS brand_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id UUID NOT NULL REFERENCES brand_kits (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  width DOUBLE PRECISION NOT NULL,
  height DOUBLE PRECISION NOT NULL,
  -- Where the group sat in the frame it was made in, and that frame's size,
  -- so a copy lands in the same place on a frame of the same size.
  placement JSONB NOT NULL DEFAULT '{}'::jsonb,
  layers JSONB NOT NULL CHECK (jsonb_typeof(layers) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_components_kit_idx
  ON brand_components (brand_kit_id, lower(name));
