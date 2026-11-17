-- What an image looks like, in words and colours, for searching by colour and
-- mood (api/_lib/imageDescribe.ts): a short description (mood, style, objects,
-- setting) and its dominant colours as lower-case #rrggbb.
--
-- Written once per image, when it is saved and by scripts/describe-images.ts
-- for what was saved before. Null until then; search falls back to the title.
--
-- Schema only. Idempotent like every patch.

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS ai_description TEXT,
  ADD COLUMN IF NOT EXISTS colors TEXT[];

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS ai_description TEXT,
  ADD COLUMN IF NOT EXISTS colors TEXT[];
