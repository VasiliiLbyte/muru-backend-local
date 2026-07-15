-- 027_lookbook_banner_image.sql
-- Separate grid cover from detail-page hero banner on lookbooks.
-- No backfill (customer decision).

ALTER TABLE content_lookbooks
  ADD COLUMN IF NOT EXISTS banner_image JSONB;
