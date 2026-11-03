-- Component instances: a brand component placed on a board as one item.
--
-- Patch 048 stored components; their copies were loose layers, which came
-- apart. An instance is now a single item of kind 'component' whose config
-- names the component and the values of its properties; it's drawn from the
-- component, so every instance changes when the component does. Like a
-- drawing, it's defined by its config.
--
-- `props` on a component lists what an instance may set: a name, a type
-- (text or color) and the layer field it drives.
--
-- Schema only. Idempotent like every patch: constraints are dropped by name
-- first and re-added with the new kind.

ALTER TABLE board_items DROP CONSTRAINT IF EXISTS board_items_kind_check;
ALTER TABLE board_items DROP CONSTRAINT IF EXISTS board_items_shape;

ALTER TABLE board_items
  ADD CONSTRAINT board_items_kind_check
  CHECK (
    kind IN (
      'photo', 'reference', 'note', 'text', 'op', 'frame', 'shader', 'drawing',
      'component'
    )
  );

ALTER TABLE board_items
  ADD CONSTRAINT board_items_shape CHECK (
    (kind = 'photo' AND photo_id IS NOT NULL)
    OR (kind = 'reference' AND image_url IS NOT NULL)
    OR (kind IN ('note', 'text', 'frame') AND body IS NOT NULL)
    OR (kind = 'op' AND node_type IS NOT NULL)
    OR (kind IN ('shader', 'drawing', 'component') AND config IS NOT NULL)
  );

ALTER TABLE brand_components
  ADD COLUMN IF NOT EXISTS props JSONB NOT NULL DEFAULT '[]'::jsonb;
