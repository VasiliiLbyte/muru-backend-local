-- Catalog brand placeholder URL on site_settings singleton.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS catalog_placeholder_image_url TEXT;
