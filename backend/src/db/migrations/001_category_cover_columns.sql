-- Category cover images (admin + Drive sync). Idempotent.
-- Run if you see: column "cover_drive_filename" does not exist
-- Usage: psql "$DATABASE_URL" -f backend/src/db/migrations/001_category_cover_columns.sql

ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_drive_filename TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
