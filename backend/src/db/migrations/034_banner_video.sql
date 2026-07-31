-- Banner video JSON for home content_banners (H.264 MP4 + poster via upload-video).
ALTER TABLE content_banners ADD COLUMN IF NOT EXISTS video JSONB;
