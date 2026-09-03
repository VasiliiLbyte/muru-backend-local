-- One-time backfill: clear stale placeholder URL baked into products without real photos.
-- The current placeholder is applied dynamically via getCatalogPlaceholderImageUrl().
UPDATE products
SET image_url_1 = '',
    image_url_2 = '',
    image_urls = '[]'::jsonb
WHERE image_url_1 = '/uploads/2843e507-19d3-412c-b727-6955f194daf5.webp'
  AND (image_urls = '["\/uploads\/2843e507-19d3-412c-b727-6955f194daf5.webp"]'::jsonb
       OR image_urls = '[]'::jsonb);
