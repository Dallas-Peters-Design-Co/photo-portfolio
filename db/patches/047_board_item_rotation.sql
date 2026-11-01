-- Rotation for board items: degrees clockwise about the item's centre.
--
-- A column rather than a key in `config` or `text_style`, because every kind
-- of item can turn (a picture, a shape, a line of text) and those two blobs
-- each belong to particular kinds. x, y, width and height stay the unrotated
-- box, so everything that reads geometry keeps working and a rotation is only
-- applied when drawing.
--
-- Schema only. Existing rows read 0, which is how they have always drawn.

ALTER TABLE board_items
  ADD COLUMN IF NOT EXISTS rotation DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN board_items.rotation IS
  'Degrees clockwise about the item''s centre, -180 to 180. 0 is upright.';
