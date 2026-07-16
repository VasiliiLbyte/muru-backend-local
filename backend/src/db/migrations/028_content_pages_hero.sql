-- 028_content_pages_hero.sql
-- Optional hero/banner image for static CMS pages (contacts, help, etc.).

ALTER TABLE content_pages
  ADD COLUMN IF NOT EXISTS hero_image JSONB;
